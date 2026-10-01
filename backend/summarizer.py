import os
import datetime
from sqlalchemy.orm import Session
from backend.models import UserParameters, UserGoal, Workout
from backend.metrics import calculate_ctl_atl_tsb

SUMMARIES_DIR = os.path.join(os.path.dirname(__file__), "data", "summaries")

DEFAULT_DIRECTIVES_MD = """# AI Coach Directives & Athlete Context

Toimi kokeneena pyöräilyvalmentajana ja urheilufysiologina. Tässä ovat urheilijaprofiilini, taustani, rajoitteeni, tavoitteeni ja nykyinen fysiologinen tilanteeni. Ota nämä tarkasti huomioon kaikissa tulevissa harjoitusohjelmissa, palautteenannossa ja treenianalyyseissä:

---

### 1. Urheilija & arjen reunaehdot
* **Profiili:** 46-vuotias mies.
* **Elämäntilanne:** 4 lasta, kokopäivätyö ja arjen kiireet. Kokonaiskuormitus ja autonomisen hermoston palautuminen ovat avainasemassa: lepopäivät ja unensuhde treeniin ovat ehdottomia, eikä treeni saa ajaa ylirasitukseen.
* **Käytettävissä oleva harjoitusaika:** 5–8 tuntia viikossa.
* **Tausta:** Vahva ja pitkä jääkiekkotausta (erinomainen anaerobinen teho ja nopeat lihassolut, aiemmin taipumus survomiseen ja liialliseen voimankäyttöön). Runsaasti maastopyöräilyä ja ulkoajoa.

---

### 2. Päätavoitteet kohti kevättä ja kesää 2027
1. **Gravel-kisakunto kesälle 2027:** Tavoitteena kestää useiden tuntien kovia sorakisoja taloudellisesti ilman hiipumista.
2. **Tehotavoite (FTP-nosto & matkasäätö):** Nostaa nykyinen kynnysteho (FTP 210 W) kevääksi tasolle 245–260 W, jotta ~200 W matkateho tuntuu hallitulta ja kestettävältä Zone 3 / alakynnysvauhdilta matalilla sykkeillä (tavoitesyke matkateholla 200 W < 140 bpm).
3. **Zwift-kilpailut (Tammi–maaliskuu 2027):** 2–3 kuukauden jakso, jossa ajetaan korkeintaan 1 Zwift-kisa viikossa korvaamaan viikon kova harjoitus. Tämä toimii VO2max- ja anaerobisen kestävyyden herättäjänä rakennetun peruskuntopohjan päälle.
"""

def ensure_summaries_dir():
    os.makedirs(SUMMARIES_DIR, exist_ok=True)

def ensure_coaching_directives_md():
    ensure_summaries_dir()
    filepath = os.path.join(SUMMARIES_DIR, "coaching_directives.md")
    if not os.path.exists(filepath):
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(DEFAULT_DIRECTIVES_MD)

def generate_athlete_profile_md(params: UserParameters, goal: UserGoal) -> str:
    lang = "Finnish" if params.language == "fi" else "English"
    return f"""# Athlete Profile & Goals

- **FTP (Functional Threshold Power):** {params.ftp:.0f} W
- **CP (Critical Power):** {params.cp or params.ftp:.0f} W
- **W' (Anaerobic Work Capacity):** {params.w_prime or 20000:.0f} J
- **LTHR (Lactate Threshold HR):** {params.lthr} bpm
- **Max HR:** {params.max_hr} bpm | **Resting HR:** {params.resting_hr} bpm
- **Weight:** {params.weight_kg:.1f} kg | **Bike Weight:** {params.bike_weight_kg:.1f} kg
- **Gender / Age:** {params.gender} / {params.age}
- **Language Preference:** {lang}

## Goal & Race Parameters
- **Primary Goal:** {goal.goal_description}
- **Target Date:** {goal.target_date or 'Not set'}
- **Race Distance:** {goal.race_distance_km} km | **Elevation Gain:** {goal.elevation_gain_m} m
- **Surface:** {goal.surface_type}
- **Weekly Capacity:** {goal.weekly_capacity_hours} hours/week
- **Intensity Distribution:** {goal.intensity_distribution}
- **Limitations / Injuries:** {goal.limitations or 'None'}
- **Custom Directives:** {getattr(goal, 'custom_prompt', '') or 'None'}
"""

def generate_weekly_history_md(db: Session, params: UserParameters) -> str:
    all_workouts = db.query(Workout).order_by(Workout.timestamp.asc()).all()
    
    if not all_workouts:
        return """# Weekly Training Load & History

No workouts uploaded yet.
"""

    workouts_list = [{"date": w.timestamp.date(), "tss": w.tss or 0.0} for w in all_workouts]
    history_metrics = calculate_ctl_atl_tsb(workouts_list)
    
    current_ctl = history_metrics[-1]["ctl"] if history_metrics else 0.0
    current_atl = history_metrics[-1]["atl"] if history_metrics else 0.0
    current_tsb = history_metrics[-1]["tsb"] if history_metrics else 0.0

    weeks_map = {}
    for w in reversed(all_workouts):
        w_date = w.timestamp.date()
        week_start = w_date - datetime.timedelta(days=w_date.weekday())
        
        if week_start not in weeks_map:
            weeks_map[week_start] = {
                "total_duration_s": 0.0,
                "total_tss": 0.0,
                "total_km": 0.0,
                "count": 0,
                "workouts": []
            }
        
        weeks_map[week_start]["total_duration_s"] += (w.duration_seconds or 0.0)
        weeks_map[week_start]["total_tss"] += (w.tss or 0.0)
        weeks_map[week_start]["total_km"] += ((w.distance_meters or 0.0) / 1000.0)
        weeks_map[week_start]["count"] += 1
        weeks_map[week_start]["workouts"].append(w)

    sorted_week_starts = sorted(weeks_map.keys(), reverse=True)[:6]

    rows = []
    for ws in sorted_week_starts:
        wdata = weeks_map[ws]
        hrs = wdata["total_duration_s"] / 3600.0
        km = wdata["total_km"]
        tss = wdata["total_tss"]
        cnt = wdata["count"]
        
        key_titles = [f"{w.title} ({int(w.duration_seconds/60)}m, TSS {w.tss:.0f})" for w in wdata["workouts"][:3]]
        titles_str = ", ".join(key_titles)
        
        week_str = f"Week of {ws.strftime('%Y-%m-%d')}"
        rows.append(f"| {week_str} | {hrs:.1f}h ({km:.0f}km) | {tss:.0f} TSS | {cnt} session(s) | {titles_str} |")

    table_body = "\n".join(rows) if rows else "| No data | - | - | - | - |"

    return f"""# Weekly Training Load & History

- **Current Load Status:** CTL (Fitness): **{current_ctl:.1f}** | ATL (Fatigue): **{current_atl:.1f}** | TSB (Form): **{current_tsb:.1f}**

## Last 6 Weeks Summary Table
| Week | Volume | Total TSS | Sessions | Key Workouts |
|---|---|---|---|---|
{table_body}
"""

def generate_latest_workout_md(db: Session, params: UserParameters) -> str:
    latest = db.query(Workout).order_by(Workout.timestamp.desc()).first()
    if not latest:
        return """# Latest Workout Analysis

No workouts recorded yet.
"""

    duration_min = int(latest.duration_seconds / 60) if latest.duration_seconds else 0
    dist_km = (latest.distance_meters / 1000.0) if latest.distance_meters else 0.0
    
    gc_metrics = []
    if latest.vi:
        gc_metrics.append(f"**VI (Variability Index):** {latest.vi:.2f}")
    if latest.ef:
        gc_metrics.append(f"**EF (Efficiency Factor):** {latest.ef:.2f}")
    if latest.aerobic_decoupling is not None:
        gc_metrics.append(f"**Aerobic Decoupling (Pw:HR):** {latest.aerobic_decoupling:+.1f}%")
    if latest.matches_burned is not None:
        gc_metrics.append(f"**Matches Burned (>CP surges):** {latest.matches_burned}")
    if latest.w_prime_min is not None and params.w_prime:
        w_pct = (latest.w_prime_min / params.w_prime) * 100.0
        gc_metrics.append(f"**Min W'bal Remaining:** {int(latest.w_prime_min)} J ({w_pct:.0f}%)")
    if latest.peak_20min_power:
        gc_metrics.append(f"**Peak 20-min Power:** {latest.peak_20min_power:.0f} W")

    gc_str = "\n- ".join(gc_metrics) if gc_metrics else "Standard metrics recorded."

    sensors = []
    if latest.real_power_present:
        sensors.append("Power Meter")
    elif latest.estimated_power_present:
        sensors.append("Estimated Power")
    if latest.hr_present:
        sensors.append("Heart Rate Monitor")

    return f"""# Latest Workout Analysis

- **Title:** {latest.title}
- **Date & Time:** {latest.timestamp.strftime('%Y-%m-%d %H:%M')}
- **Duration:** {duration_min} min | **Distance:** {dist_km:.1f} km
- **Avg Power:** {latest.average_power or 0:.0f} W | **Max Power:** {latest.max_power or 0:.0f} W
- **Normalized Power (NP):** {latest.np or 0:.0f} W | **IF (Intensity Factor):** {latest.if_factor or 0:.2f}
- **TSS:** {latest.tss or 0:.1f} ({latest.tss_type or 'power'})
- **Avg HR:** {latest.average_hr or 0:.0f} bpm | **Max HR:** {latest.max_hr or 0} bpm
- **Sensors:** {', '.join(sensors) if sensors else 'None'}

## Advanced Sports Science (Golden Cheetah) Metrics
- {gc_str}
"""

def update_all_summaries(db: Session):
    """Päivittää kaikki MD-tiedostot backend/data/summaries/ kansioon."""
    ensure_summaries_dir()
    ensure_coaching_directives_md()
    
    params = db.query(UserParameters).first() or UserParameters()
    goal = db.query(UserGoal).first() or UserGoal()
    
    profile_md = generate_athlete_profile_md(params, goal)
    weekly_md = generate_weekly_history_md(db, params)
    latest_md = generate_latest_workout_md(db, params)
    
    with open(os.path.join(SUMMARIES_DIR, "athlete_profile.md"), "w", encoding="utf-8") as f:
        f.write(profile_md)
        
    with open(os.path.join(SUMMARIES_DIR, "weekly_history.md"), "w", encoding="utf-8") as f:
        f.write(weekly_md)
        
    with open(os.path.join(SUMMARIES_DIR, "latest_workout.md"), "w", encoding="utf-8") as f:
        f.write(latest_md)
        
    return {
        "status": "success",
        "files_updated": ["coaching_directives.md", "athlete_profile.md", "weekly_history.md", "latest_workout.md"]
    }
