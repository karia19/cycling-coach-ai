import json
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.models import Workout, UserParameters

# Tool Definitions (Schemas) for OpenAI / Ollama function calling
AGENT_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_workout_history",
            "description": "Searches past workouts in the athlete's database by keyword, minimum TSS, or date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Keyword to search in workout titles (e.g., 'Intervals', 'Race', 'Gravel', 'Z2', 'Test')"
                    },
                    "min_tss": {
                        "type": "number",
                        "description": "Minimum TSS (Training Stress Score) filter"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of workouts to return (default 5)"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_power_curve_bests",
            "description": "Gets the athlete's peak power outputs (max power, peak 20min power, highest TSS) over a given number of days.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days back to inspect (e.g. 30, 90, 365)"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_specific_workout_details",
            "description": "Fetches detailed sports science metrics for a specific workout by its ID or title search.",
            "parameters": {
                "type": "object",
                "properties": {
                    "workout_query": {
                        "type": "string",
                        "description": "Workout ID or title to look up"
                    }
                },
                "required": ["workout_query"]
            }
        }
    }
]

def search_workout_history(db: Session, keyword: str = "", min_tss: float = 0.0, limit: int = 5) -> str:
    query = db.query(Workout)
    
    if keyword:
        query = query.filter(Workout.title.ilike(f"%{keyword}%"))
    if min_tss > 0:
        query = query.filter(Workout.tss >= min_tss)
        
    results = query.order_by(Workout.timestamp.desc()).limit(limit).all()
    
    if not results:
        return f"No workouts found matching query (keyword='{keyword}', min_tss={min_tss})."
        
    lines = []
    for w in results:
        duration_min = int(w.duration_seconds / 60) if w.duration_seconds else 0
        lines.append(
            f"- [{w.timestamp.strftime('%Y-%m-%d')}] '{w.title}' (ID: {w.id}) | "
            f"Duration: {duration_min}m | TSS: {w.tss or 0:.1f} | Avg Power: {w.average_power or 0:.0f}W | "
            f"NP: {w.np or 0:.0f}W | Peak 20min: {w.peak_20min_power or 0:.0f}W"
        )
    return "\n".join(lines)

def get_power_curve_bests(db: Session, days: int = 90) -> str:
    workouts = db.query(Workout).order_by(Workout.timestamp.desc()).all()
    if not workouts:
        return "No workout data available to calculate power curve bests."
        
    max_power_workout = max(workouts, key=lambda w: w.max_power or 0, default=None)
    max_20min_workout = max(workouts, key=lambda w: w.peak_20min_power or 0, default=None)
    max_tss_workout = max(workouts, key=lambda w: w.tss or 0, default=None)
    
    lines = [f"### Peak Power Achievements (Last {days} days / All time)"]
    if max_power_workout and max_power_workout.max_power:
        lines.append(f"- **Max Sprint Power:** {max_power_workout.max_power:.0f} W on {max_power_workout.timestamp.strftime('%Y-%m-%d')} ({max_power_workout.title})")
    if max_20min_workout and max_20min_workout.peak_20min_power:
        lines.append(f"- **Peak 20-min Power:** {max_20min_workout.peak_20min_power:.0f} W on {max_20min_workout.timestamp.strftime('%Y-%m-%d')} ({max_20min_workout.title})")
    if max_tss_workout and max_tss_workout.tss:
        lines.append(f"- **Highest TSS Session:** {max_tss_workout.tss:.1f} TSS on {max_tss_workout.timestamp.strftime('%Y-%m-%d')} ({max_tss_workout.title})")
        
    return "\n".join(lines)

def get_specific_workout_details(db: Session, workout_query: str) -> str:
    workout = db.query(Workout).filter(or_(Workout.id == workout_query, Workout.title.ilike(f"%{workout_query}%"))).first()
    if not workout:
        return f"Workout '{workout_query}' not found."
        
    params = db.query(UserParameters).first() or UserParameters()
    w_pct = (workout.w_prime_min / params.w_prime * 100.0) if (workout.w_prime_min and params.w_prime) else None
    w_pct_str = f"{w_pct:.0f}%" if w_pct is not None else "N/A"
    
    return f"""### Workout Detail: {workout.title} ({workout.timestamp.strftime('%Y-%m-%d')})
- Duration: {int(workout.duration_seconds/60)} min | Distance: {(workout.distance_meters/1000.0):.1f} km
- Avg Power: {workout.average_power or 0:.0f} W | Max Power: {workout.max_power or 0:.0f} W
- NP: {workout.np or 0:.0f} W | IF: {workout.if_factor or 0:.2f} | TSS: {workout.tss or 0:.1f}
- Avg HR: {workout.average_hr or 0:.0f} bpm | Max HR: {workout.max_hr or 0} bpm
- Variability Index (VI): {workout.vi or 'N/A'} | Efficiency Factor (EF): {workout.ef or 'N/A'}
- Aerobic Decoupling: {workout.aerobic_decoupling or 0:+.1f}% | Matches Burned: {workout.matches_burned or 0}
- Min W'bal: {workout.w_prime_min or 'N/A'} J ({w_pct_str})
"""

def execute_agent_tool(tool_name: str, arguments: dict, db: Session) -> str:
    """Executes a tool call requested by the LLM."""
    if tool_name == "search_workout_history":
        return search_workout_history(
            db=db,
            keyword=arguments.get("keyword", ""),
            min_tss=arguments.get("min_tss", 0.0),
            limit=arguments.get("limit", 5)
        )
    elif tool_name == "get_power_curve_bests":
        return get_power_curve_bests(
            db=db,
            days=arguments.get("days", 90)
        )
    elif tool_name == "get_specific_workout_details":
        return get_specific_workout_details(
            db=db,
            workout_query=arguments.get("workout_query", "")
        )
    else:
        return f"Unknown tool name: {tool_name}"
