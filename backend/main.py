import os
import uuid
import shutil
import datetime
import fitparse
import numpy as np
import pandas as pd
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.config import settings
from backend.database import engine, Base, get_db
from backend.models import UserParameters, UserGoal, RawFile, Workout, WorkoutStream
from backend.schemas import (
    UserParametersBase, UserParametersResponse,
    UserGoalBase, UserGoalResponse,
    RawFileResponse, WorkoutListResponse, WorkoutDetailResponse,
    MergeRequest, ChatRequest, ChatResponse,
    DashboardSummaryResponse, WorkoutUpdateSchema, WorkoutSyncPayload, SyncResultResponse, SyncServerRequest, ManualWorkoutRequest
)
from backend.parser import parse_file, haversine_distance, parse_fit_file, parse_iso_datetime
from backend.metrics import (
    calculate_metrics_for_workout, calculate_ctl_atl_tsb,
    calculate_power_duration_curve_for_stream, calculate_wprime_balance,
    calculate_cp_and_wprime
)
from pydantic import BaseModel
from backend.coach import generate_coaching_response
from backend.summarizer import update_all_summaries, ensure_coaching_directives_md, SUMMARIES_DIR

def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    """
    If SERVER_API_KEY environment variable is set, validate X-API-Key header.
    If SERVER_API_KEY is empty/not set, allow request without key.
    """
    expected_key = os.getenv("SERVER_API_KEY", "")
    if expected_key and x_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Virheellinen tai puuttuva X-API-Key -avain."
        )

# Auto-create tables on startup
Base.metadata.create_all(bind=engine)

# Ensure data directories exist
os.makedirs(os.path.join(settings.DATA_DIR, "raw"), exist_ok=True)
os.makedirs(os.path.join(settings.DATA_DIR, "suunto"), exist_ok=True)

from sqlalchemy import text
def auto_migrate_db(engine):
    """Adds missing columns to database tables dynamically on startup."""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    
    # Check user_parameters columns
    columns = [col["name"] for col in inspector.get_columns("user_parameters")]
    with engine.begin() as conn:
        if "llm_provider" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN llm_provider TEXT DEFAULT 'ollama'"))
        if "llm_api_key" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN llm_api_key TEXT DEFAULT ''"))
        if "llm_model" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN llm_model TEXT DEFAULT 'llama3.1'"))
        if "ollama_url" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN ollama_url TEXT DEFAULT 'http://localhost:11434'"))
        if "gender" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN gender TEXT DEFAULT 'unspecified'"))
        if "sync_mode" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN sync_mode TEXT DEFAULT 'local'"))
        if "remote_server_url" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN remote_server_url TEXT DEFAULT 'https://cycling-sync.oivauix.org'"))
        if "remote_api_key" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN remote_api_key TEXT DEFAULT 'my_very_secure_secret_token_12345'"))
        if "strava_client_id" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN strava_client_id TEXT DEFAULT ''"))
        if "strava_client_secret" not in columns:
            conn.execute(text("ALTER TABLE user_parameters ADD COLUMN strava_client_secret TEXT DEFAULT ''"))

    # Check workouts columns
    workout_columns = [col["name"] for col in inspector.get_columns("workouts")]
    with engine.begin() as conn:
        if "peak_20min_power" not in workout_columns:
            conn.execute(text("ALTER TABLE workouts ADD COLUMN peak_20min_power FLOAT"))
        if "source" not in workout_columns:
            conn.execute(text("ALTER TABLE workouts ADD COLUMN source TEXT DEFAULT 'local'"))
        if "strava_id" not in workout_columns:
            conn.execute(text("ALTER TABLE workouts ADD COLUMN strava_id TEXT"))

    # Check raw_files columns
    raw_columns = [col["name"] for col in inspector.get_columns("raw_files")]
    with engine.begin() as conn:
        if "source" not in raw_columns:
            conn.execute(text("ALTER TABLE raw_files ADD COLUMN source TEXT DEFAULT 'local'"))

    # Check user_goals columns
    goal_columns = [col["name"] for col in inspector.get_columns("user_goals")]
    with engine.begin() as conn:
        if "custom_prompt" not in goal_columns:
            conn.execute(text("ALTER TABLE user_goals ADD COLUMN custom_prompt TEXT DEFAULT ''"))

auto_migrate_db(engine)

def cleanup_duplicate_workouts(db: Session):
    """Scans for and smart-merges duplicate workouts in the database on startup."""
    workouts = db.query(Workout).order_by(Workout.timestamp.asc()).all()
    if not workouts:
        return 0

    duplicates_to_delete = []
    processed_ids = set()

    for i in range(len(workouts)):
        w1 = workouts[i]
        if w1.id in processed_ids:
            continue

        for j in range(i + 1, len(workouts)):
            w2 = workouts[j]
            if w2.id in processed_ids:
                continue

            if not w1.timestamp or not w2.timestamp:
                continue

            time_diff = abs((w1.timestamp - w2.timestamp).total_seconds())
            dur_diff = abs((w1.duration_seconds or 0.0) - (w2.duration_seconds or 0.0))

            if time_diff <= 1800 and dur_diff <= 600:
                w1_score = (1 if w1.average_hr else 0) * 10 + (1 if w1.average_power else 0) * 5 + (len(w1.source_file_ids or []))
                w2_score = (1 if w2.average_hr else 0) * 10 + (1 if w2.average_power else 0) * 5 + (len(w2.source_file_ids or []))

                primary, secondary = (w1, w2) if w1_score >= w2_score else (w2, w1)

                if not primary.average_hr and secondary.average_hr:
                    primary.average_hr = secondary.average_hr
                    primary.max_hr = secondary.max_hr
                    primary.hr_present = True

                if not primary.average_power and secondary.average_power:
                    primary.average_power = secondary.average_power
                    primary.max_power = secondary.max_power
                    primary.np = secondary.np
                    primary.if_factor = secondary.if_factor
                    primary.real_power_present = secondary.real_power_present

                if not primary.tss and secondary.tss:
                    primary.tss = secondary.tss

                s_secondary = db.query(WorkoutStream).filter(WorkoutStream.workout_id == secondary.id).first()
                if s_secondary:
                    s_primary = db.query(WorkoutStream).filter(WorkoutStream.workout_id == primary.id).first()
                    if not s_primary:
                        s_secondary.workout_id = primary.id
                    else:
                        db.delete(s_secondary)

                duplicates_to_delete.append(secondary)
                processed_ids.add(secondary.id)

    if duplicates_to_delete:
        print(f"Startup Cleanup: Found {len(duplicates_to_delete)} duplicate workouts. Cleaning them up...")
        for dup in duplicates_to_delete:
            db.delete(dup)
        db.commit()
        print(f"Startup Cleanup: Successfully cleaned up {len(duplicates_to_delete)} duplicate workouts.")

    return len(duplicates_to_delete)



app = FastAPI(title="LocalCyclingCoach Backend", version="1.0.0")

# Setup CORS for local frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to get active user parameters or default
def get_user_params(db: Session) -> UserParameters:
    params = db.query(UserParameters).first()
    if not params:
        params = UserParameters()
        db.add(params)
        db.commit()
        db.refresh(params)
    return params

# Helper to get active user goals or default
def get_user_goal(db: Session) -> UserGoal:
    goal = db.query(UserGoal).first()
    if not goal:
        goal = UserGoal()
        db.add(goal)
        db.commit()
        db.refresh(goal)
    return goal

def estimate_stream_power(stream: list[dict], params: UserParameters) -> list[dict]:
    """Fills missing or flat synthetic power values in the stream using HR or speed/slope physics."""
    if not stream:
        return stream
        
    pwr_values = [r.get("power") for r in stream if isinstance(r, dict) and r.get("power") is not None and r.get("power") > 0]
    has_real_power = len(set(pwr_values)) > 1
    if has_real_power:
        return stream
        
    # User physiological constants
    ftp = params.ftp or 200.0
    lthr = params.lthr or 165
    resting_hr = params.resting_hr or 50
    max_hr = params.max_hr or 190
    weight_total = (params.weight_kg or 75.0) + (params.bike_weight_kg or 9.0)
    
    hr_range = lthr - resting_hr
    if hr_range <= 0:
        hr_range = 115
        
    for r in stream:
        if not isinstance(r, dict):
            continue
        est_p = None
        # 1. Estimate from Heart Rate (physiological effort)
        if r.get("heart_rate") is not None and r.get("heart_rate") > 0:
            hr = r["heart_rate"]
            est_p = ftp * (hr - resting_hr) / hr_range
            est_p = max(0.0, est_p)
            
        # 2. Fallback to physical model (speed & slope) if HR is missing
        elif r.get("speed") is not None:
            speed = r["speed"] # m/s
            p_rolling = 0.005 * weight_total * 9.81 * speed
            p_aero = 0.5 * 0.32 * 1.2 * (speed ** 3)
            est_p = p_rolling + p_aero
            
        if est_p is not None:
            r["power"] = float(est_p)
            
    return stream


def backfill_estimated_power(db: Session):
    """Backfills estimated power for existing workouts that lack power data."""
    workouts = db.query(Workout).filter(
        Workout.real_power_present == False,
        Workout.estimated_power_present == False
    ).all()
    
    if not workouts:
        return
        
    print(f"Startup Backfill: Found {len(workouts)} workouts without power. Calculating estimates...")
    params = get_user_params(db)
    
    for w in workouts:
        stream = db.query(WorkoutStream).filter(WorkoutStream.workout_id == w.id).first()
        if stream and stream.stream_data:
            # Run estimate
            est_stream = estimate_stream_power(stream.stream_data, params)
            # Update stream database record
            stream.stream_data = est_stream
            db.add(stream)
            
            # Recalculate metrics
            calc = calculate_metrics_for_workout(
                est_stream,
                ftp=params.ftp,
                lthr=params.lthr,
                resting_hr=params.resting_hr,
                max_hr=params.max_hr,
                cp=params.cp,
                w_prime=params.w_prime,
                weight_kg=params.weight_kg
            )
            
            # Update workout metrics
            w.average_power = calc.get("average_power")
            w.max_power = calc.get("max_power")
            w.np = calc.get("np")
            w.if_factor = calc.get("if_factor")
            w.tss = calc.get("tss")
            w.tss_type = calc.get("tss_type")
            w.w_prime_min = calc.get("w_prime_min")
            w.matches_burned = calc.get("matches_burned")
            w.vi = calc.get("vi")
            w.ef = calc.get("ef")
            w.aerobic_decoupling = calc.get("aerobic_decoupling")
            w.vo2max_est = calc.get("vo2max_est")
            w.aerobic_work_kj = calc.get("aerobic_work_kj")
            w.anaerobic_work_kj = calc.get("anaerobic_work_kj")
            w.estimated_power_present = True
            db.add(w)
            
    try:
        db.commit()
        print("Startup Backfill: Backfilled estimated power successfully.")
    except Exception as e:
        db.rollback()
        print(f"Startup Backfill failed: {str(e)}")

def recalculate_all_workout_metrics(db: Session):
    """Recalculates advanced science metrics for all workouts with stream data."""
    workouts = db.query(Workout).all()
    params = get_user_params(db)
    
    updated_count = 0
    for w in workouts:
        stream = db.query(WorkoutStream).filter(WorkoutStream.workout_id == w.id).first()
        if stream and stream.stream_data:
            calc = calculate_metrics_for_workout(
                stream.stream_data,
                ftp=params.ftp or 200.0,
                lthr=params.lthr or 165,
                resting_hr=params.resting_hr or 50,
                max_hr=params.max_hr or 190,
                cp=params.cp or params.ftp or 200.0,
                w_prime=params.w_prime or 20000.0,
                weight_kg=params.weight_kg or 75.0
            )
            
            if calc.get("average_power") is not None:
                w.average_power = calc.get("average_power")
            if calc.get("max_power") is not None:
                w.max_power = calc.get("max_power")
            if calc.get("np") is not None:
                w.np = calc.get("np")
            if calc.get("if_factor") is not None:
                w.if_factor = calc.get("if_factor")
            if calc.get("tss") is not None and calc.get("tss") > 0:
                w.tss = calc.get("tss")
                w.tss_type = calc.get("tss_type")
                
            w.w_prime_min = calc.get("w_prime_min")
            w.matches_burned = calc.get("matches_burned")
            w.vi = calc.get("vi")
            w.ef = calc.get("ef")
            w.aerobic_decoupling = calc.get("aerobic_decoupling")
            w.vo2max_est = calc.get("vo2max_est")
            w.aerobic_work_kj = calc.get("aerobic_work_kj")
            w.anaerobic_work_kj = calc.get("anaerobic_work_kj")
            
            db.add(w)
            updated_count += 1
            
    try:
        db.commit()
        print(f"Startup Recalculate: Updated Golden Cheetah science metrics for {updated_count} workouts.")
    except Exception as e:
        db.rollback()
        print(f"Startup Recalculate failed: {str(e)}")

# Run duplicate cleanup, estimated power backfill, and science metrics recalculation on startup
from backend.database import SessionLocal
startup_db = SessionLocal()
try:
    cleanup_duplicate_workouts(startup_db)
    backfill_estimated_power(startup_db)
    recalculate_all_workout_metrics(startup_db)
finally:
    startup_db.close()

# --- Settings Endpoints ---

@app.get("/api/settings/parameters", response_model=UserParametersResponse)
def get_parameters(db: Session = Depends(get_db)):
    return get_user_params(db)

@app.post("/api/settings/parameters", response_model=UserParametersResponse)
def update_parameters(params_in: UserParametersBase, db: Session = Depends(get_db)):
    params = get_user_params(db)
    for field, value in params_in.model_dump().items():
        setattr(params, field, value)
    db.commit()
    db.refresh(params)
    update_all_summaries(db)
    return params

@app.get("/api/settings/goals", response_model=UserGoalResponse)
def get_goals(db: Session = Depends(get_db)):
    return get_user_goal(db)

@app.post("/api/settings/goals", response_model=UserGoalResponse)
def update_goals(goal_in: UserGoalBase, db: Session = Depends(get_db)):
    goal = get_user_goal(db)
    for field, value in goal_in.model_dump().items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    update_all_summaries(db)
    return goal

@app.post("/api/summaries/refresh")
def refresh_summaries(db: Session = Depends(get_db)):
    return update_all_summaries(db)

class DirectivesUpdateSchema(BaseModel):
    directives_md: str

@app.get("/api/settings/directives")
@app.get("/api/settings/coaching-directives")
def get_coaching_directives():
    ensure_coaching_directives_md()
    filepath = os.path.join(SUMMARIES_DIR, "coaching_directives.md")
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return {"directives_md": f.read()}
    return {"directives_md": ""}

@app.post("/api/settings/directives")
@app.post("/api/settings/coaching-directives")
def update_coaching_directives(payload: DirectivesUpdateSchema, db: Session = Depends(get_db)):
    ensure_coaching_directives_md()
    filepath = os.path.join(SUMMARIES_DIR, "coaching_directives.md")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(payload.directives_md)
    update_all_summaries(db)
    return {"status": "success", "directives_md": payload.directives_md}

@app.post("/api/settings/reset")
def reset_database(db: Session = Depends(get_db)):
    """Wipes all data from the database and deletes uploads for privacy."""
    try:
        db.query(WorkoutStream).delete()
        db.query(Workout).delete()
        db.query(RawFile).delete()
        db.query(UserGoal).delete()
        db.query(UserParameters).delete()
        db.commit()
        
        # Clear raw files folder
        raw_dir = os.path.join(settings.DATA_DIR, "raw")
        if os.path.exists(raw_dir):
            shutil.rmtree(raw_dir)
            os.makedirs(raw_dir, exist_ok=True)
            
        return {"status": "success", "message": "All workout data wiped successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Wipe failed: {str(e)}")

# --- Workout Endpoints ---

@app.get("/api/workouts", response_model=List[WorkoutListResponse])
def get_workouts(db: Session = Depends(get_db)):
    return db.query(Workout).order_by(Workout.timestamp.desc()).all()

@app.get("/api/workouts/unmerged", response_model=List[RawFileResponse])
def get_unmerged_files(db: Session = Depends(get_db)):
    return db.query(RawFile).filter(RawFile.status == "unmerged").order_by(RawFile.upload_time.desc()).all()

@app.get("/api/workouts/{workout_id}", response_model=WorkoutDetailResponse)
def get_workout(workout_id: str, db: Session = Depends(get_db)):
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout

@app.get("/api/workouts/{workout_id}/stream")
def get_workout_stream(workout_id: str, db: Session = Depends(get_db)):
    stream = db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout_id).first()
    if not stream or not stream.stream_data:
        raise HTTPException(status_code=404, detail="Workout stream not found")
        
    params = get_user_params(db)
    cp = params.cp if (params.cp and params.cp > 0) else (params.ftp or 200.0)
    w_prime = params.w_prime if (params.w_prime and params.w_prime > 0) else 20000.0
    
    stream_data = stream.stream_data or []
    power_vals = [r.get("power") for r in stream_data if isinstance(r, dict) and r.get("power") is not None and r.get("power") > 0]
    has_real_power = len(set(power_vals)) > 1
    if not has_real_power:
        stream_data = estimate_stream_power(stream_data, params)

    power_list = [r.get("power") for r in stream_data if isinstance(r, dict)]
    if any(p is not None and p > 0 for p in power_list):
        w_bal_res = calculate_wprime_balance(power_list, cp, w_prime)
        w_series = w_bal_res["w_prime_series"]
        
        enriched_stream = []
        for i, r in enumerate(stream_data):
            if isinstance(r, dict):
                r_copy = dict(r)
                if i < len(w_series):
                    r_copy["w_prime_bal"] = round(w_series[i], 1)
                enriched_stream.append(r_copy)
            else:
                enriched_stream.append(r)
        return enriched_stream
        
    return stream_data

@app.post("/api/parameters/estimate-cp")
def estimate_cp_and_wprime_endpoint(db: Session = Depends(get_db)):
    """Estimates Critical Power (CP) and W' from the athlete's power-duration curve across all workouts."""
    workouts = db.query(Workout).all()
    params = get_user_params(db)
    
    overall_pd_curve: dict[int, float] = {}
    
    for w in workouts:
        stream = db.query(WorkoutStream).filter(WorkoutStream.workout_id == w.id).first()
        if stream and stream.stream_data:
            curve = calculate_power_duration_curve_for_stream(stream.stream_data)
            for dur, pwr in curve.items():
                if pwr > overall_pd_curve.get(dur, 0.0):
                    overall_pd_curve[dur] = pwr
                    
    cp_est, w_prime_est = calculate_cp_and_wprime(overall_pd_curve, fallback_ftp=params.ftp or 200.0)
    
    params.cp = cp_est
    params.w_prime = w_prime_est
    db.commit()
    db.refresh(params)
    
    return {
        "status": "success",
        "cp": cp_est,
        "w_prime": w_prime_est,
        "message": f"Estimated Critical Power: {cp_est} W, W': {int(w_prime_est)} J"
    }

def calculate_skiba_w_prime(power_stream: list[float], ftp: float, w_0: float = 20000.0, tau: float = 300.0) -> list[float]:
    """Calculates Skiba's W' Balance (in kJ) timeseries."""
    w_bal = w_0
    w_prime_series = []
    
    for p in power_stream:
        if p > ftp:
            # Deplete
            w_bal -= (p - ftp) * 1.0  # dt = 1s
        else:
            # Recharge: W'_t = W'_{t-1} + (W'_0 - W'_{t-1}) / \tau
            w_bal += (w_0 - w_bal) / tau * 1.0
            
        # Clamp between 0 and w_0
        w_bal = max(0.0, min(w_0, w_bal))
        w_prime_series.append(w_bal / 1000.0) # convert to kJ
        
    return w_prime_series

def calculate_aerobic_decoupling(power_stream: list[float], hr_stream: list[float]) -> dict:
    """Calculates Aerobic Decoupling (Pw:HR) drift between first and second half."""
    # Filter where both are present
    valid_data = [(p, h) for p, h in zip(power_stream, hr_stream) if p is not None and h is not None]
    if len(valid_data) < 60: # need at least 1 minute of data
        return {"decoupling_percent": 0.0, "p1": 0, "hr1": 0, "p2": 0, "hr2": 0}
        
    n = len(valid_data)
    half = n // 2
    
    p1 = [x[0] for x in valid_data[:half]]
    hr1 = [x[1] for x in valid_data[:half]]
    
    p2 = [x[0] for x in valid_data[half:]]
    hr2 = [x[1] for x in valid_data[half:]]
    
    avg_p1 = np.mean(p1)
    avg_hr1 = np.mean(hr1)
    
    avg_p2 = np.mean(p2)
    avg_hr2 = np.mean(hr2)
    
    ef1 = avg_p1 / avg_hr1 if avg_hr1 > 0 else 0
    ef2 = avg_p2 / avg_hr2 if avg_hr2 > 0 else 0
    
    if ef1 > 0:
        drift = (ef1 - ef2) / ef1 * 100.0
    else:
        drift = 0.0
        
    return {
        "decoupling_percent": float(drift),
        "p1": float(avg_p1),
        "hr1": float(avg_hr1),
        "p2": float(avg_p2),
        "hr2": float(avg_hr2)
    }

def calculate_zones_distribution(power_stream: list[float], hr_stream: list[float], ftp: float, lthr: int) -> dict:
    """Calculates time spent in Power (Z1-Z6) and HR (Z1-Z5) zones."""
    import numpy as np
    power_counts = {f"Z{i}": 0 for i in range(1, 7)}
    hr_counts = {f"Z{i}": 0 for i in range(1, 6)}
    
    # Power zones percentage
    total_p = 0
    for p in power_stream:
        if p is None or p < 10:  # ignore zeroes/coasting for zone distributions
            continue
        total_p += 1
        pct = (p / ftp) * 100.0 if ftp > 0 else 0
        if pct < 55:
            power_counts["Z1"] += 1
        elif pct <= 75:
            power_counts["Z2"] += 1
        elif pct <= 90:
            power_counts["Z3"] += 1
        elif pct <= 105:
            power_counts["Z4"] += 1
        elif pct <= 120:
            power_counts["Z5"] += 1
        else:
            power_counts["Z6"] += 1
            
    # HR zones percentage
    total_hr = 0
    for h in hr_stream:
        if h is None or h < 40:
            continue
        total_hr += 1
        pct = (h / lthr) * 100.0 if lthr > 0 else 0
        if pct < 68:
            hr_counts["Z1"] += 1
        elif pct <= 83:
            hr_counts["Z2"] += 1
        elif pct <= 94:
            hr_counts["Z3"] += 1
        elif pct <= 105:
            hr_counts["Z4"] += 1
        else:
            hr_counts["Z5"] += 1
            
    # Convert counts to percentages
    p_dist = {k: (v / total_p * 100.0 if total_p > 0 else 0.0) for k, v in power_counts.items()}
    hr_dist = {k: (v / total_hr * 100.0 if total_hr > 0 else 0.0) for k, v in hr_counts.items()}
    
    return {
        "power_zones": p_dist,
        "hr_zones": hr_dist,
        "total_power_seconds": total_p,
        "total_hr_seconds": total_hr
    }

@app.get("/api/workouts/{workout_id}/analytics")
def get_workout_analytics(workout_id: str, db: Session = Depends(get_db)):
    stream = db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout_id).first()
    if not stream or not stream.stream_data:
        raise HTTPException(status_code=404, detail="Workout stream not found")
        
    params = get_user_params(db)
    import numpy as np
    
    # Extract lists of power and hr
    p_stream = [r.get("power") for r in stream.stream_data]
    hr_stream = [r.get("heart_rate") for r in stream.stream_data]
    
    # Convert None to 0 for W' Balance calculations
    p_clean = [float(p) if p is not None else 0.0 for p in p_stream]
    
    w_prime = calculate_skiba_w_prime(p_clean, ftp=params.ftp)
    decoupling = calculate_aerobic_decoupling(p_stream, hr_stream)
    zones = calculate_zones_distribution(p_stream, hr_stream, ftp=params.ftp, lthr=params.lthr)
    
    return {
        "w_prime": w_prime,
        "decoupling": decoupling,
        "zones": zones
    }

@app.get("/api/dashboard/power-curve")
def get_power_curve(db: Session = Depends(get_db)):
    """Computes all-time and season best power duration curves."""
    streams = db.query(WorkoutStream).all()
    workouts = db.query(Workout).all()
    
    # Create lookup map for workout dates
    workout_dates = {w.id: w.timestamp for w in workouts}
    
    durations = [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600]
    all_time_peaks = {d: 0.0 for d in durations}
    season_peaks = {d: 0.0 for d in durations} # last 90 days
    
    cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=90)
    
    for s in streams:
        dt = workout_dates.get(s.workout_id)
        is_season = dt and dt >= cutoff_date
        
        curve = calculate_power_duration_curve_for_stream(s.stream_data)
        for d, val in curve.items():
            if val > all_time_peaks[d]:
                all_time_peaks[d] = val
            if is_season and val > season_peaks[d]:
                season_peaks[d] = val
                
    durations_labels = {
        1: "1s", 5: "5s", 15: "15s", 30: "30s", 
        60: "1m", 120: "2m", 300: "5m", 600: "10m", 
        1200: "20m", 1800: "30m", 3600: "1h"
    }
    
    output = []
    for d in durations:
        output.append({
            "duration": d,
            "label": durations_labels[d],
            "allTime": all_time_peaks[d],
            "season": season_peaks[d]
        })
        
    return output

@app.delete("/api/workouts/{workout_id}")
def delete_workout(workout_id: str, db: Session = Depends(get_db)):
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
        
    try:
        # Attempt deletion from remote server (cycling-sync.oivauix.org)
        try:
            user_p = get_user_params(db)
            server_url = (user_p.remote_server_url or "https://cycling-sync.oivauix.org").strip().rstrip("/")
            api_key_to_use = user_p.remote_api_key or "my_very_secure_secret_token_12345"
            if server_url and workout.timestamp:
                import urllib.request
                import urllib.parse
                import ssl
                ctx = ssl._create_unverified_context()
                ts_str = workout.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                delete_urls = [
                    f"{server_url}/api/workouts/{workout_id}",
                    f"{server_url}/api/sync/workout/{workout_id}",
                    f"{server_url}/api/workouts/by-timestamp?started_at={urllib.parse.quote(ts_str)}"
                ]
                for d_url in delete_urls:
                    try:
                        req = urllib.request.Request(d_url, headers={"X-API-Key": api_key_to_use, "User-Agent": "Mozilla/5.0"}, method="DELETE")
                        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
                            if resp.status in (200, 204):
                                print(f"Deleted workout {workout_id} from remote server ({d_url})")
                                break
                    except Exception:
                        pass
        except Exception:
            pass

        # Delete associated stream
        db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout_id).delete()
        
        # Reset original RawFiles status to unmerged if it was a merged workout
        if workout.is_merged:
            for file_id in workout.source_file_ids:
                raw_f = db.query(RawFile).filter(RawFile.id == file_id).first()
                if raw_f:
                    raw_f.status = "unmerged"
                    
                    # Re-create original workout for this raw file
                    filepath = raw_f.filepath
                    if os.path.exists(filepath):
                        try:
                            parsed = parse_file(filepath)
                            params = get_user_params(db)
                            has_real_power = "power" in parsed["meta"]["sensors_present"]
                            if not has_real_power:
                                parsed["stream"] = estimate_stream_power(parsed["stream"], params)
                                
                            calc = calculate_metrics_for_workout(
                                parsed["stream"],
                                ftp=params.ftp,
                                lthr=params.lthr,
                                resting_hr=params.resting_hr,
                                max_hr=params.max_hr
                            )
                            
                            orig_workout = Workout(
                                id=raw_f.id,
                                title=raw_f.filename,
                                timestamp=parsed["meta"]["start_time"] or raw_f.upload_time,
                                duration_seconds=parsed["meta"]["duration_seconds"],
                                distance_meters=parsed["meta"]["distance_meters"],
                                average_power=calc.get("average_power"),
                                max_power=calc.get("max_power"),
                                average_hr=calc.get("average_hr"),
                                max_hr=calc.get("max_hr"),
                                average_cadence=calc.get("average_cadence"),
                                total_elevation_gain=parsed["meta"]["total_elevation_gain"],
                                calories=parsed["meta"]["calories"],
                                tss=calc.get("tss"),
                                tss_type=calc.get("tss_type"),
                                np=calc.get("np"),
                                if_factor=calc.get("if_factor"),
                                is_merged=False,
                                real_power_present=has_real_power,
                                estimated_power_present=not has_real_power,
                                hr_present="hr" in parsed["meta"]["sensors_present"],
                                source_file_ids=[raw_f.id]
                            )
                            db.add(orig_workout)
                            
                            orig_stream = WorkoutStream(
                                workout_id=raw_f.id,
                                stream_data=parsed["stream"]
                            )
                            db.add(orig_stream)
                        except Exception:
                            pass # Ignore promotion errors on deletion
        else:
            # If it is a normal workout, delete associated RawFile records and raw files on disk
            file_ids_to_clean = set(workout.source_file_ids or [])
            file_ids_to_clean.add(workout.id)
            for file_id in file_ids_to_clean:
                raw_f = db.query(RawFile).filter(RawFile.id == file_id).first()
                if raw_f:
                    if raw_f.filepath and os.path.exists(raw_f.filepath):
                        try:
                            os.remove(raw_f.filepath)
                        except Exception:
                            pass
                    db.delete(raw_f)
                    
        db.delete(workout)
        db.commit()
        return {"status": "success", "message": "Workout deleted successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

@app.put("/api/workouts/{workout_id}", response_model=WorkoutDetailResponse)
@app.patch("/api/workouts/{workout_id}", response_model=WorkoutDetailResponse)
def update_workout(
    workout_id: str,
    update_data: WorkoutUpdateSchema,
    db: Session = Depends(get_db),
    api_key: None = Depends(verify_api_key)
):
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    params = get_user_params(db)

    if update_data.title is not None:
        workout.title = update_data.title
    if update_data.timestamp is not None:
        workout.timestamp = update_data.timestamp
    if update_data.duration_seconds is not None:
        workout.duration_seconds = update_data.duration_seconds
    if update_data.distance_meters is not None:
        workout.distance_meters = update_data.distance_meters
    if update_data.average_power is not None:
        workout.average_power = update_data.average_power
        workout.real_power_present = True
    if update_data.max_power is not None:
        workout.max_power = update_data.max_power
    if update_data.average_hr is not None:
        workout.average_hr = update_data.average_hr
        workout.hr_present = True
    if update_data.max_hr is not None:
        workout.max_hr = update_data.max_hr
    if update_data.average_cadence is not None:
        workout.average_cadence = update_data.average_cadence
    if update_data.total_elevation_gain is not None:
        workout.total_elevation_gain = update_data.total_elevation_gain
    if update_data.calories is not None:
        workout.calories = update_data.calories

    if update_data.tss is not None:
        workout.tss = update_data.tss
    else:
        duration_hours = (workout.duration_seconds or 0.0) / 3600.0
        if workout.average_power and params.ftp > 0:
            if_factor = workout.average_power / params.ftp
            workout.if_factor = round(if_factor, 2)
            workout.tss = round(duration_hours * (if_factor ** 2) * 100, 1)
            workout.tss_type = "power"
        elif workout.average_hr and params.lthr > 0:
            hr_ratio = workout.average_hr / params.lthr
            workout.if_factor = round(hr_ratio, 2)
            workout.tss = round(duration_hours * (hr_ratio ** 2) * 100, 1)
            workout.tss_type = "hr"

    db.commit()
    db.refresh(workout)
    return workout


def normalize_workout_payload(item: dict) -> WorkoutSyncPayload:
    """Normalizes raw dictionary data from various JSON formats into WorkoutSyncPayload."""
    title = item.get("title") or item.get("plan_name") or item.get("name") or "Harjoitus"

    timestamp = None
    raw_start = item.get("timestamp") or item.get("started_at") or item.get("start_time") or item.get("date")
    if raw_start:
        if isinstance(raw_start, datetime.datetime):
            timestamp = raw_start
        elif isinstance(raw_start, str):
            try:
                timestamp = parse_iso_datetime(raw_start)
            except Exception:
                try:
                    timestamp = datetime.datetime.fromisoformat(raw_start.replace("Z", "+00:00"))
                except Exception:
                    pass

    duration_seconds = item.get("duration_seconds") or item.get("duration") or item.get("total_time_seconds")
    if duration_seconds is None and item.get("started_at") and item.get("ended_at"):
        try:
            s_str = item["started_at"]
            e_str = item["ended_at"]
            s_dt = parse_iso_datetime(s_str) if isinstance(s_str, str) else s_str
            e_dt = parse_iso_datetime(e_str) if isinstance(e_str, str) else e_str
            if s_dt and e_dt:
                duration_seconds = (e_dt - s_dt).total_seconds()
        except Exception:
            pass
    
    duration_seconds = float(duration_seconds) if duration_seconds is not None else 0.0

    distance_meters = item.get("distance_meters")
    if distance_meters is None and item.get("total_distance_km") is not None:
        distance_meters = float(item["total_distance_km"]) * 1000.0
    elif distance_meters is None and item.get("distance_km") is not None:
        distance_meters = float(item["distance_km"]) * 1000.0
    elif distance_meters is None:
        distance_meters = float(item.get("distance", 0.0))

    average_power = item.get("average_power") or item.get("avg_power_watts") or item.get("avg_power")
    if average_power is not None:
        average_power = float(average_power)

    max_power = item.get("max_power") or item.get("max_power_watts") or item.get("max_power_1s")
    if max_power is not None:
        max_power = float(max_power)

    np_val = item.get("np") or item.get("normalized_power")
    if np_val is not None:
        np_val = float(np_val)

    if_val = item.get("if_factor") or item.get("intensity_factor")
    if if_val is not None:
        if_val = float(if_val)

    peak_20min = item.get("peak_20min_power") or item.get("max_power_20min")
    if peak_20min is not None:
        peak_20min = float(peak_20min)

    average_hr = item.get("average_hr") or item.get("avg_hr") or item.get("avg_hr_bpm") or item.get("heart_rate") or item.get("heart_rate_bpm")
    if average_hr is not None and float(average_hr) > 0:
        average_hr = float(average_hr)
    else:
        average_hr = None

    max_hr = item.get("max_hr")
    if max_hr is not None:
        max_hr = int(max_hr)

    average_cadence = item.get("average_cadence") or item.get("avg_cadence") or item.get("cadence")
    if average_cadence is not None:
        average_cadence = float(average_cadence)

    total_elevation_gain = item.get("total_elevation_gain") or item.get("elevation_gain") or item.get("elevation")
    if total_elevation_gain is not None:
        total_elevation_gain = float(total_elevation_gain)

    calories = item.get("calories") or item.get("total_kj")
    if calories is not None:
        calories = float(calories)

    tss = item.get("tss")
    if tss is not None:
        tss = float(tss)

    external_id = str(item.get("id")) if item.get("id") is not None else (item.get("external_id") or item.get("workout_id"))

    return WorkoutSyncPayload(
        title=str(title),
        timestamp=timestamp or datetime.datetime.utcnow(),
        duration_seconds=duration_seconds,
        distance_meters=distance_meters,
        average_power=average_power,
        max_power=max_power,
        average_hr=average_hr,
        max_hr=max_hr,
        average_cadence=average_cadence,
        total_elevation_gain=total_elevation_gain,
        calories=calories,
        tss=tss,
        np=np_val,
        if_factor=if_val,
        peak_20min_power=peak_20min,
        external_id=external_id,
        overwrite=bool(item.get("overwrite", False))
    )

@app.post("/api/sync/workout", response_model=SyncResultResponse)
def sync_workout(
    payload_input: dict,
    db: Session = Depends(get_db),
    api_key: None = Depends(verify_api_key)
):
    payload = normalize_workout_payload(payload_input)
    time_delta = datetime.timedelta(minutes=3)
    duration_delta = 30.0

    existing_workout = None
    if payload.external_id:
        existing_workout = db.query(Workout).filter(Workout.id == payload.external_id).first()

    if not existing_workout and payload.timestamp:
        existing_workout = db.query(Workout).filter(
            Workout.timestamp >= payload.timestamp - time_delta,
            Workout.timestamp <= payload.timestamp + time_delta,
            Workout.duration_seconds >= payload.duration_seconds - duration_delta,
            Workout.duration_seconds <= payload.duration_seconds + duration_delta
        ).first()

    if existing_workout and not payload.overwrite:
        updated_fields = False
        if payload.average_hr and (not existing_workout.average_hr or existing_workout.average_hr == 0):
            existing_workout.average_hr = payload.average_hr
            if payload.max_hr:
                existing_workout.max_hr = payload.max_hr
            existing_workout.hr_present = True
            updated_fields = True
        if payload.average_power and (not existing_workout.average_power or existing_workout.average_power == 0):
            existing_workout.average_power = payload.average_power
            if payload.max_power:
                existing_workout.max_power = payload.max_power
            if payload.np:
                existing_workout.np = payload.np
            if payload.if_factor:
                existing_workout.if_factor = payload.if_factor
            updated_fields = True

        if updated_fields:
            db.commit()
            db.refresh(existing_workout)
            return SyncResultResponse(
                status="updated",
                message=f"Harjoituksen '{existing_workout.title}' tiedot päivitettiin uudella syke/tehodatalla.",
                workout=existing_workout
            )

        return SyncResultResponse(
            status="duplicate_found",
            message=f"Harjoitus on jo olemassa nimellä '{existing_workout.title}' (ID: {existing_workout.id}).",
            workout=existing_workout
        )

    params = get_user_params(db)

    tss = payload.tss
    if tss is None:
        duration_hours = payload.duration_seconds / 3600.0 if payload.duration_seconds else 0.0
        if payload.average_power and params.ftp > 0:
            if_factor = payload.average_power / params.ftp
            tss = round(duration_hours * (if_factor ** 2) * 100, 1)
        elif payload.average_hr and params.lthr > 0:
            hr_ratio = payload.average_hr / params.lthr
            tss = round(duration_hours * (hr_ratio ** 2) * 100, 1)

    if existing_workout and payload.overwrite:
        existing_workout.title = payload.title
        existing_workout.timestamp = payload.timestamp
        existing_workout.duration_seconds = payload.duration_seconds
        existing_workout.distance_meters = payload.distance_meters or existing_workout.distance_meters
        existing_workout.average_power = payload.average_power or existing_workout.average_power
        existing_workout.max_power = payload.max_power or existing_workout.max_power
        existing_workout.average_hr = payload.average_hr or existing_workout.average_hr
        existing_workout.max_hr = payload.max_hr or existing_workout.max_hr
        existing_workout.average_cadence = payload.average_cadence or existing_workout.average_cadence
        existing_workout.total_elevation_gain = payload.total_elevation_gain or existing_workout.total_elevation_gain
        existing_workout.calories = payload.calories or existing_workout.calories
        existing_workout.np = payload.np or existing_workout.np
        existing_workout.if_factor = payload.if_factor or existing_workout.if_factor
        existing_workout.peak_20min_power = payload.peak_20min_power or existing_workout.peak_20min_power
        if tss is not None:
            existing_workout.tss = tss
        db.commit()
        db.refresh(existing_workout)
        return SyncResultResponse(
            status="updated",
            message="Harjoitus päivitettiin palvelimella.",
            workout=existing_workout
        )
    else:
        workout_id = payload.external_id or str(uuid.uuid4())
        workout = Workout(
            id=workout_id,
            title=payload.title,
            timestamp=payload.timestamp,
            duration_seconds=payload.duration_seconds,
            distance_meters=payload.distance_meters or 0.0,
            average_power=payload.average_power,
            max_power=payload.max_power,
            average_hr=payload.average_hr,
            max_hr=payload.max_hr,
            average_cadence=payload.average_cadence,
            total_elevation_gain=payload.total_elevation_gain,
            calories=payload.calories,
            tss=tss,
            tss_type="power" if payload.average_power else ("hr" if payload.average_hr else "estimated"),
            np=payload.np,
            if_factor=payload.if_factor,
            peak_20min_power=payload.peak_20min_power,
            is_merged=False,
            real_power_present=payload.average_power is not None,
            estimated_power_present=False,
            hr_present=payload.average_hr is not None,
            source_file_ids=[workout_id]
        )
        db.add(workout)
        db.commit()
        db.refresh(workout)
        return SyncResultResponse(
            status="created",
            message="Uusi harjoitus tallennettu palvelimelle.",
            workout=workout
        )

@app.post("/api/workouts/upload-json", response_model=SyncResultResponse)
async def upload_json_workout(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    api_key: None = Depends(verify_api_key)
):
    import json
    try:
        contents = await file.read()
        data = json.loads(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Virheellinen JSON-tiedosto: {str(e)}")

    if isinstance(data, list):
        results = []
        for item in data:
            try:
                if isinstance(item, dict):
                    res = sync_workout(item, db=db, api_key=api_key)
                    results.append(res)
                elif isinstance(item, WorkoutSyncPayload):
                    res = sync_workout(item.dict(), db=db, api_key=api_key)
                    results.append(res)
            except Exception as e:
                print(f"JSON import error for item: {e}")
        return SyncResultResponse(
            status="success",
            message=f"Ladattiin {len(results)} JSON-harjoitusta palvelimelle."
        )
    elif isinstance(data, dict):
        return sync_workout(data, db=db, api_key=api_key)
    else:
        raise HTTPException(status_code=400, detail="JSON-tiedoston on oltava harjoitusolio tai lista harjoituksista.")

@app.post("/api/workouts/sync-from-server")
def sync_from_remote_server(
    req: Optional[SyncServerRequest] = None,
    db: Session = Depends(get_db),
    api_key: None = Depends(verify_api_key)
):
    """
    Connects to the specified Remote Server URL (e.g. cycling-sync.oivauix.org),
    fetches all workouts, normalizes them, and saves missing workouts into local database.
    """
    import urllib.request
    import json
    import ssl

    user_p = get_user_params(db)

    server_url = (req.server_url.strip() if req and req.server_url else user_p.remote_server_url) or "https://cycling-sync.oivauix.org"
    if not server_url or server_url == "http://localhost:8000":
        server_url = "https://cycling-sync.oivauix.org"
    server_url = server_url.rstrip("/")
    if not server_url.startswith("http://") and not server_url.startswith("https://"):
        server_url = "https://" + server_url

    api_key_to_use = (req.api_key.strip() if req and req.api_key else user_p.remote_api_key) or "my_very_secure_secret_token_12345"

    urls_to_try = [
        f"{server_url}/api/workouts",
        f"{server_url}/api/workouts/export",
        f"{server_url}/workouts"
    ]
    
    data = None
    last_error = ""
    ssl_context = ssl._create_unverified_context()

    for url in urls_to_try:
        try:
            request = urllib.request.Request(url)
            request.add_header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
            if api_key_to_use:
                request.add_header("X-API-Key", api_key_to_use)
            with urllib.request.urlopen(request, context=ssl_context, timeout=15) as response:
                if response.status == 200:
                    body = response.read().decode('utf-8')
                    parsed = json.loads(body)
                    if isinstance(parsed, list):
                        data = parsed
                        break
        except Exception as e:
            last_error = str(e)
            # Try fallback using curl with -k for unverified SSL
            try:
                import subprocess
                cmd = ["curl", "-s", "-L", "-k", "-H", f"X-API-Key: {api_key_to_use}", url]
                out = subprocess.check_output(cmd, timeout=15).decode('utf-8')
                parsed = json.loads(out)
                if isinstance(parsed, list):
                    data = parsed
                    break
            except Exception as e2:
                last_error = f"{str(e)} | Curl: {str(e2)}"
            continue

    if data is None:
        raise HTTPException(
            status_code=400,
            detail=f"Ei saatu yhteyttä palvelimeen ({server_url}). Virhe: {last_error}"
        )

    imported_count = 0
    updated_count = 0

    for item in data:
        if isinstance(item, dict):
            try:
                res = sync_workout(item, db=db, api_key=api_key)
                if res.status == "created":
                    imported_count += 1
                elif res.status == "updated":
                    updated_count += 1
            except Exception as e:
                print(f"Error syncing item: {e}")

    return {
        "status": "success",
        "message": f"Synkronoitiin Ubuntu-palvelimelta ({server_url}): {imported_count} uutta harjoitusta, {updated_count} päivitetty.",
        "imported_count": imported_count,
        "updated_count": updated_count,
        "total_fetched": len(data)
    }

def push_workout_to_remote_server(workout: Workout, db: Session, server_url: str = "https://cycling-sync.oivauix.org", api_key: str = "my_very_secure_secret_token_12345") -> bool:
    """
    Pushes a local workout (including merged power, HR, NP, TSS, and telemetry points)
    to the central remote server (cycling-sync.oivauix.org).
    """
    import urllib.request
    import json
    import ssl
    from datetime import timedelta

    if not workout or not workout.timestamp:
        return False

    server_url = (server_url or "https://cycling-sync.oivauix.org").strip().rstrip("/")
    if not server_url.startswith("http://") and not server_url.startswith("https://"):
        server_url = "https://" + server_url

    url = f"{server_url}/api/sync/workout"

    # Retrieve stream data if present
    stream_rec = db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout.id).first()
    stream_data = stream_rec.stream_data if stream_rec and stream_rec.stream_data else []

    datapoints = []
    max_1s = 0
    max_5s = 0
    max_1m = 0
    max_5m = 0
    max_20m = 0

    if stream_data:
        p_list = []
        for r in stream_data:
            if isinstance(r, dict):
                p_val = r.get("power")
                p_num = int(p_val) if p_val is not None and p_val > 0 else 0
                p_list.append(p_num)

                speed_val = r.get("speed")
                speed_kmh = float(speed_val * 3.6) if speed_val is not None and speed_val > 0 else 0.0

                hr_val = r.get("heart_rate")
                hr_bpm = int(hr_val) if hr_val is not None and hr_val > 0 else None

                cad_val = r.get("cadence")
                cad_rpm = int(cad_val) if cad_val is not None and cad_val > 0 else 0

                datapoints.append({
                    "elapsed_seconds": int(round(r.get("time_offset", 0))),
                    "power_watts": p_num,
                    "speed_kmh": speed_kmh,
                    "cadence_rpm": cad_rpm,
                    "heart_rate_bpm": hr_bpm,
                    "latitude": float(r.get("latitude")) if r.get("latitude") is not None else None,
                    "longitude": float(r.get("longitude")) if r.get("longitude") is not None else None,
                    "elevation": float(r.get("altitude")) if r.get("altitude") is not None else None
                })
        
        if p_list:
            s_p = pd.Series(p_list)
            max_1s = int(s_p.max()) if len(s_p) >= 1 else 0
            max_5s = int(s_p.rolling(5, min_periods=1).mean().max()) if len(s_p) >= 5 else max_1s
            max_1m = int(s_p.rolling(60, min_periods=1).mean().max()) if len(s_p) >= 60 else max_5s
            max_5m = int(s_p.rolling(300, min_periods=1).mean().max()) if len(s_p) >= 300 else max_1m
            max_20m = int(s_p.rolling(1200, min_periods=1).mean().max()) if len(s_p) >= 1200 else max_5m

    dur = int(workout.duration_seconds or 0)
    start_ts = workout.timestamp.strftime("%Y-%m-%d %H:%M:%S")
    end_ts = (workout.timestamp + timedelta(seconds=dur)).strftime("%Y-%m-%d %H:%M:%S")

    payload = {
        "workout_plan_id": None,
        "plan_name": workout.title or "Free Ride",
        "started_at": start_ts,
        "ended_at": end_ts,
        "total_distance_km": round((workout.distance_meters or 0) / 1000.0, 3),
        "avg_power_watts": float(workout.average_power or 0.0),
        "normalized_power": float(workout.np or workout.average_power or 0.0),
        "tss": float(workout.tss or 0.0),
        "intensity_factor": float(workout.if_factor or 0.0),
        "total_kj": round(((workout.average_power or 0.0) * dur) / 1000.0, 1),
        "max_power_1s": max(max_1s, int(workout.max_power or 0)),
        "max_power_5s": max(max_5s, int(workout.max_power or 0)),
        "max_power_1min": max_1m,
        "max_power_5min": max_5m,
        "max_power_20min": max(max_20m, int(workout.peak_20min_power or 0)),
        "zone_time": {"1": 0, "2": dur, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0},
        "datapoints": datapoints
    }

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
        "User-Agent": "Mozilla/5.0"
    }

    ctx = ssl._create_unverified_context()
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            print(f"Pushed workout '{workout.title}' ({workout.id}) to remote server ({server_url}): {res_data}")
            return True
    except Exception as e:
        print(f"Failed to push workout '{workout.title}' to remote server: {e}")
        return False

@app.post("/api/workouts/push-to-server")
def push_workouts_to_remote_server(
    req: Optional[SyncServerRequest] = None,
    db: Session = Depends(get_db),
    api_key: None = Depends(verify_api_key)
):
    """
    Pushes all local workouts (and merged telemetry) up to the central server (cycling-sync.oivauix.org).
    """
    user_p = get_user_params(db)
    server_url = (req.server_url.strip() if req and req.server_url else user_p.remote_server_url) or "https://cycling-sync.oivauix.org"
    api_key_to_use = (req.api_key.strip() if req and req.api_key else user_p.remote_api_key) or "my_very_secure_secret_token_12345"

    workouts = db.query(Workout).order_by(Workout.timestamp.desc()).all()
    pushed_count = 0

    for w in workouts:
        success = push_workout_to_remote_server(w, db, server_url=server_url, api_key=api_key_to_use)
        if success:
            pushed_count += 1

    return {
        "status": "success",
        "message": f"Lähetetty {pushed_count} harjoitusta palvelimelle ({server_url}).",
        "pushed_count": pushed_count
    }

@app.post("/api/workouts/cleanup-duplicates")
async def cleanup_duplicates_endpoint(
    db: Session = Depends(get_db),
    api_key: None = Depends(verify_api_key)
):
    """
    Scans all saved workouts in the database, detects duplicate entries with matching
    or close started_at timestamps (within 180s) and duration (within 30s), retains
    the first/best entry, and deletes redundant duplicate entries.
    """
    workouts = db.query(Workout).order_by(Workout.timestamp.asc()).all()
    duplicates_to_delete = []
    seen = []  # list of Workout objects

    for w in workouts:
        is_dup = False
        if w.timestamp:
            for seen_w in seen:
                if seen_w.timestamp:
                    time_diff = abs((w.timestamp - seen_w.timestamp).total_seconds())
                    dur_diff = abs((w.duration_seconds or 0) - (seen_w.duration_seconds or 0))
                    if time_diff <= 180 and dur_diff <= 30:
                        duplicates_to_delete.append(w)
                        is_dup = True
                        break
        if not is_dup:
            seen.append(w)

    deleted_count = len(duplicates_to_delete)
    if duplicates_to_delete:
        for dup in duplicates_to_delete:
            db.query(WorkoutStream).filter(WorkoutStream.workout_id == dup.id).delete()
            if dup.source_file_ids:
                for file_id in dup.source_file_ids:
                    raw_f = db.query(RawFile).filter(RawFile.id == file_id).first()
                    if raw_f:
                        if os.path.exists(raw_f.filepath):
                            try:
                                os.remove(raw_f.filepath)
                            except Exception:
                                pass
                        db.delete(raw_f)
            db.delete(dup)
        db.commit()

    return {
        "status": "success",
        "message": f"Duplikaattien siivous suoritettu. Poistettiin {deleted_count} duplikaattia.",
        "deleted_count": deleted_count
    }

@app.get("/api/workouts/export")
async def export_workouts(
    db: Session = Depends(get_db),
    api_key: None = Depends(verify_api_key)
):
    """
    Exports all workouts from the database in JSON format, including full
    telemetry datapoints stream for each workout.
    """
    workouts = db.query(Workout).order_by(Workout.timestamp.asc()).all()
    export_data = []

    for w in workouts:
        stream_obj = db.query(WorkoutStream).filter(WorkoutStream.workout_id == w.id).first()
        stream_data = stream_obj.stream_data if stream_obj else []

        w_dict = {
            "id": w.id,
            "title": w.title,
            "started_at": w.timestamp.isoformat() if w.timestamp else None,
            "duration_seconds": w.duration_seconds,
            "distance_meters": w.distance_meters,
            "average_power": w.average_power,
            "max_power": w.max_power,
            "average_hr": w.average_hr,
            "max_hr": w.max_hr,
            "average_cadence": w.average_cadence,
            "total_elevation_gain": w.total_elevation_gain,
            "calories": w.calories,
            "tss": w.tss,
            "tss_type": w.tss_type,
            "np": w.np,
            "if_factor": w.if_factor,
            "peak_20min_power": w.peak_20min_power,
            "is_merged": w.is_merged,
            "real_power_present": w.real_power_present,
            "estimated_power_present": w.estimated_power_present,
            "hr_present": w.hr_present,
            "source_file_ids": w.source_file_ids or [],
            "datapoints": stream_data
        }
        export_data.append(w_dict)

    headers = {
        "Content-Disposition": "attachment; filename=workouts_backup.json"
    }
    return JSONResponse(content=export_data, headers=headers)

def process_single_upload_file(file_bytes: bytes, filename: str, db: Session):
    import io, zipfile
    ext = filename.split(".")[-1].lower().strip()
    if "fit" in ext or filename.lower().endswith(".fit"):
        ext = "fit"
    elif "tcx" in ext or filename.lower().endswith(".tcx"):
        ext = "tcx"
    elif "gpx" in ext or filename.lower().endswith(".gpx"):
        ext = "gpx"
    elif "zip" in ext or filename.lower().endswith(".zip"):
        processed = []
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes), 'r') as zip_ref:
                for z_name in zip_ref.namelist():
                    if z_name.startswith("__MACOSX") or os.path.basename(z_name).startswith("."):
                        continue
                    z_ext = z_name.split(".")[-1].lower().strip()
                    if z_ext in ["fit", "tcx", "gpx"]:
                        sub_bytes = zip_ref.read(z_name)
                        sub_res = process_single_upload_file(sub_bytes, os.path.basename(z_name), db)
                        if sub_res:
                            processed.extend(sub_res if isinstance(sub_res, list) else [sub_res])
        except Exception as ze:
            print(f"Zip extraction error: {ze}")
        return processed
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file format '{ext}' in {filename}. Must be .fit, .tcx, .gpx, or .zip")

    file_id = str(uuid.uuid4())
    raw_dir = os.path.join(settings.DATA_DIR, "raw")
    os.makedirs(raw_dir, exist_ok=True)
    
    filepath = os.path.join(raw_dir, f"{file_id}.{ext}")
    with open(filepath, "wb") as buffer:
        buffer.write(file_bytes)
        
    try:
        # Parse workout
        parsed = parse_file(filepath)
        meta = parsed["meta"]
        
        # SMART AUTO-MERGE: Check if matching workout exists on server (within +/- 30 minutes)
        if meta["start_time"]:
            time_delta = datetime.timedelta(minutes=30)
            existing_workout = db.query(Workout).filter(
                Workout.timestamp >= meta["start_time"] - time_delta,
                Workout.timestamp <= meta["start_time"] + time_delta
            ).first()
            
            if existing_workout:
                # Merge new file stream into existing_workout
                existing_stream_rec = db.query(WorkoutStream).filter(WorkoutStream.workout_id == existing_workout.id).first()
                if existing_stream_rec and existing_stream_rec.stream_data:
                    existing_stream = existing_stream_rec.stream_data
                    new_stream = parsed["stream"] or []
                    
                    # Index new stream by timestamp
                    new_by_ts = {}
                    for r in new_stream:
                        ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r["timestamp"]
                        if ts:
                            new_by_ts[ts.replace(microsecond=0)] = r
                            
                    # Check if existing power or HR stream is flat/synthetic
                    existing_powers = [r.get("power") for r in existing_stream if isinstance(r, dict) and r.get("power") is not None and r.get("power") > 0]
                    existing_hrs = [r.get("heart_rate") for r in existing_stream if isinstance(r, dict) and r.get("heart_rate") is not None and r.get("heart_rate") > 0]
                    existing_power_is_flat = len(set(existing_powers)) <= 1
                    existing_hr_is_flat = len(set(existing_hrs)) <= 1

                    # Merge streams: combine HR, Cadence, Power, Speed, Altitude into existing_stream
                    merged_stream = []
                    has_hr = False
                    for r in existing_stream:
                        ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r["timestamp"]
                        m_record = dict(r)
                        if ts:
                            ts_key = ts.replace(microsecond=0)
                            if ts_key in new_by_ts:
                                match_r = new_by_ts[ts_key]
                                if match_r.get("heart_rate") is not None and match_r.get("heart_rate") > 0:
                                    if m_record.get("heart_rate") is None or m_record.get("heart_rate") == 0 or existing_hr_is_flat:
                                        m_record["heart_rate"] = match_r["heart_rate"]
                                if match_r.get("power") is not None and match_r.get("power") > 0:
                                    if m_record.get("power") is None or m_record.get("power") == 0 or existing_power_is_flat:
                                        m_record["power"] = match_r["power"]
                                if match_r.get("cadence") is not None and (m_record.get("cadence") is None or m_record.get("cadence") == 0):
                                    m_record["cadence"] = match_r["cadence"]
                                if match_r.get("speed") is not None and (m_record.get("speed") is None or m_record.get("speed") == 0):
                                    m_record["speed"] = match_r["speed"]
                        if m_record.get("heart_rate") is not None and m_record.get("heart_rate") > 0:
                            has_hr = True
                        merged_stream.append(m_record)
                        
                    # Save updated stream
                    existing_stream_rec.stream_data = merged_stream
                    
                    # Recalculate metrics for merged workout
                    params = get_user_params(db)
                    calc = calculate_metrics_for_workout(
                        merged_stream,
                        ftp=params.ftp,
                        lthr=params.lthr,
                        resting_hr=params.resting_hr,
                        max_hr=params.max_hr
                    )
                    
                    if calc.get("average_hr"): existing_workout.average_hr = calc.get("average_hr")
                    if calc.get("max_hr"): existing_workout.max_hr = calc.get("max_hr")
                    if calc.get("ef"): existing_workout.ef = calc.get("ef")
                    if calc.get("aerobic_decoupling"): existing_workout.aerobic_decoupling = calc.get("aerobic_decoupling")
                    if calc.get("tss"): existing_workout.tss = calc.get("tss")
                    if calc.get("np"): existing_workout.np = calc.get("np")
                    if calc.get("if_factor"): existing_workout.if_factor = calc.get("if_factor")
                    
                    existing_workout.is_merged = True
                    existing_workout.hr_present = existing_workout.hr_present or has_hr or ("hr" in meta["sensors_present"])
                    existing_workout.real_power_present = existing_workout.real_power_present or ("power" in meta["sensors_present"])
                    
                    src_ids = existing_workout.source_file_ids or []
                    if file_id not in src_ids:
                        existing_workout.source_file_ids = src_ids + [file_id]
                        
                    raw_file = RawFile(
                        id=file_id,
                        filename=filename,
                        file_type=ext,
                        upload_time=datetime.datetime.utcnow(),
                        start_time=meta["start_time"],
                        end_time=meta["end_time"],
                        sensors_present=meta["sensors_present"],
                        filepath=filepath,
                        status="merged"
                    )
                    db.add(raw_file)
                    db.commit()
                    db.refresh(existing_workout)
                    return existing_workout
        
        # Save raw file record for new workout
        raw_file = RawFile(
            id=file_id,
            filename=filename,
            file_type=ext,
            upload_time=datetime.datetime.utcnow(),
            start_time=meta["start_time"],
            end_time=meta["end_time"],
            sensors_present=meta["sensors_present"],
            filepath=filepath,
            status="unmerged"
        )
        db.add(raw_file)
        
        # Calculate initial metrics using default settings
        params = get_user_params(db)
        has_real_power = "power" in meta["sensors_present"]
        if not has_real_power:
            parsed["stream"] = estimate_stream_power(parsed["stream"], params)
            
        calc = calculate_metrics_for_workout(
            parsed["stream"],
            ftp=params.ftp,
            lthr=params.lthr,
            resting_hr=params.resting_hr,
            max_hr=params.max_hr
        )
        
        # Promote raw file to a new workout session
        workout = Workout(
            id=file_id,
            title=filename,
            timestamp=meta["start_time"] or datetime.datetime.utcnow(),
            duration_seconds=meta["duration_seconds"],
            distance_meters=meta["distance_meters"],
            average_power=calc.get("average_power"),
            max_power=calc.get("max_power"),
            average_hr=calc.get("average_hr"),
            max_hr=calc.get("max_hr"),
            average_cadence=calc.get("average_cadence"),
            total_elevation_gain=meta["total_elevation_gain"],
            calories=meta["calories"],
            tss=calc.get("tss"),
            tss_type=calc.get("tss_type"),
            np=calc.get("np"),
            if_factor=calc.get("if_factor"),
            peak_20min_power=calc.get("peak_20min_power"),
            is_merged=False,
            real_power_present=has_real_power,
            estimated_power_present=not has_real_power,
            hr_present="hr" in meta["sensors_present"],
            source_file_ids=[file_id]
        )
        db.add(workout)
        
        # Save high res stream
        stream = WorkoutStream(
            workout_id=file_id,
            stream_data=parsed["stream"]
        )
        db.add(stream)
        
        db.commit()
        db.refresh(workout)
        return workout
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=522, detail=f"Parsing error: {str(e)}")

@app.post("/api/files/upload")
@app.post("/api/workouts/upload")
async def upload_files(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    upload_list = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)
        
    if not upload_list:
        raise HTTPException(status_code=400, detail="Ei tiedostoja ladattavaksi.")

    processed_results = []
    for up_file in upload_list:
        file_bytes = await up_file.read()
        if not file_bytes:
            continue
        res = process_single_upload_file(file_bytes, up_file.filename, db)
        if res:
            if isinstance(res, list):
                processed_results.extend(res)
            else:
                processed_results.append(res)
                
    try:
        update_all_summaries(db)
    except Exception as e:
        print(f"Summary update warning: {e}")

    return JSONResponse(content={"status": "success", "processed_count": len(processed_results)})

@app.delete("/api/files/{file_id}")
def delete_raw_file(file_id: str, db: Session = Depends(get_db)):
    """Deletes a raw file record and its associated workout session and stream from disk and DB."""
    raw_f = db.query(RawFile).filter(RawFile.id == file_id).first()
    if not raw_f:
        raise HTTPException(status_code=404, detail="Tiedostoa ei löytynyt.")
        
    if raw_f.filepath and os.path.exists(raw_f.filepath):
        try:
            os.remove(raw_f.filepath)
        except Exception:
            pass
            
    db.query(WorkoutStream).filter(WorkoutStream.workout_id == file_id).delete()
    db.query(Workout).filter(Workout.id == file_id).delete()
    db.delete(raw_f)
    db.commit()
    return {"message": "Tiedosto ja siihen liittyvä harjoitus poistettu."}

@app.post("/api/workouts/cleanup-duplicates")
def trigger_cleanup_duplicates(db: Session = Depends(get_db)):
    """Triggers manual duplicate workouts cleanup on the server."""
    count = cleanup_duplicate_workouts(db)
    return {"message": f"Serverin duplikaattien siivous suoritettu onnistuneesti."}

@app.post("/api/workouts/manual")
def create_manual_workout(req: ManualWorkoutRequest, db: Session = Depends(get_db)):
    """Creates a manually entered workout in the database."""
    w_id = str(uuid.uuid4())
    ts = parse_iso_datetime(req.timestamp) if req.timestamp else datetime.datetime.utcnow()
    params = get_user_params(db)
    
    if_fac = (req.np / params.ftp) if (req.np and params.ftp > 0) else None
    ef_val = (req.np / req.average_hr) if (req.np and req.average_hr and req.average_hr > 0) else None
    
    workout = Workout(
        id=w_id,
        title=req.title or "Manuaalinen harjoitus",
        timestamp=ts,
        duration_seconds=req.duration_seconds or 0.0,
        distance_meters=req.distance_meters or 0.0,
        average_power=req.np,
        np=req.np,
        if_factor=if_fac,
        tss=req.tss or 0.0,
        average_hr=req.average_hr,
        ef=ef_val,
        is_merged=False,
        real_power_present=False,
        estimated_power_present=False,
        hr_present=bool(req.average_hr and req.average_hr > 0),
        source_file_ids=[]
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout

@app.post("/api/workouts/merge", response_model=WorkoutListResponse)
def merge_workouts(req: MergeRequest, db: Session = Depends(get_db)):
    f1 = db.query(RawFile).filter(RawFile.id == req.file_id_1).first()
    f2 = db.query(RawFile).filter(RawFile.id == req.file_id_2).first()
    
    if not f1 or not f2:
        raise HTTPException(status_code=404, detail="One or both raw files not found.")
        
    # Get original streams
    s1_rec = db.query(WorkoutStream).filter(WorkoutStream.workout_id == req.file_id_1).first()
    s2_rec = db.query(WorkoutStream).filter(WorkoutStream.workout_id == req.file_id_2).first()
    
    if not s1_rec or not s2_rec:
        raise HTTPException(status_code=404, detail="Streams not found for files.")
        
    stream1 = s1_rec.stream_data
    stream2 = s2_rec.stream_data
    
    # Merge stream logic
    # We will align timestamps. apply time_offset_seconds to file 2
    offset = datetime.timedelta(seconds=req.time_offset_seconds)
    
    # Map streams by localized datetime key
    timeline = {}
    
    # File 1 keys
    for r in stream1:
        ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r["timestamp"]
        timeline[ts] = {
            "power": r.get("power"),
            "heart_rate": r.get("heart_rate"),
            "cadence": r.get("cadence"),
            "speed": r.get("speed"),
            "altitude": r.get("altitude"),
            "lat": r.get("lat"),
            "lon": r.get("lon"),
            "distance": r.get("distance")
        }
        
    # File 2 keys with offset
    for r in stream2:
        ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r["timestamp"]
        ts_adjusted = ts + offset
        
        if ts_adjusted not in timeline:
            timeline[ts_adjusted] = {}
            
        entry = timeline[ts_adjusted]
        
        # Merge values: overwrite only if missing or file 2 values are not None
        for key in ("power", "heart_rate", "cadence", "speed", "altitude", "lat", "lon", "distance"):
            val = r.get(key)
            if val is not None:
                entry[key] = val
                
    # Sort merged timeline
    sorted_ts = sorted(timeline.keys())
    if not sorted_ts:
        raise HTTPException(status_code=400, detail="Merged workout timeline is empty.")
        
    start_time = sorted_ts[0]
    end_time = sorted_ts[-1]
    duration = (end_time - start_time).total_seconds()
    
    merged_stream = []
    for ts in sorted_ts:
        entry = timeline[ts]
        merged_stream.append({
            "timestamp": ts.isoformat(),
            "time_offset": (ts - start_time).total_seconds(),
            "power": entry.get("power"),
            "heart_rate": entry.get("heart_rate"),
            "cadence": entry.get("cadence"),
            "speed": entry.get("speed"),
            "altitude": entry.get("altitude"),
            "lat": entry.get("lat"),
            "lon": entry.get("lon"),
            "distance": entry.get("distance")
        })
        
    # Recalculate haversine distances in merged stream if GPS is present
    has_gps = any(r["lat"] is not None for r in merged_stream)
    max_dist = 0.0
    if has_gps:
        curr_dist = 0.0
        for i in range(len(merged_stream)):
            if i == 0:
                merged_stream[i]["distance"] = 0.0
            else:
                prev = merged_stream[i-1]
                curr = merged_stream[i]
                d = haversine_distance(prev["lat"], prev["lon"], curr["lat"], curr["lon"])
                curr_dist += d
                curr["distance"] = curr_dist
        max_dist = curr_dist
    else:
        # Fallback to max distance present in stream
        dists = [r["distance"] for r in merged_stream if r["distance"] is not None]
        max_dist = max(dists) if dists else 0.0
        
    # Calculate merged metrics
    params = get_user_params(db)
    calc = calculate_metrics_for_workout(
        merged_stream,
        ftp=params.ftp,
        lthr=params.lthr,
        resting_hr=params.resting_hr,
        max_hr=params.max_hr
    )
    
    # Calculate elevation gain
    elevation_gain = 0.0
    alts = [r["altitude"] for r in merged_stream if r["altitude"] is not None]
    if len(alts) > 1:
        for i in range(1, len(merged_stream)):
            a1 = merged_stream[i-1]["altitude"]
            a2 = merged_stream[i]["altitude"]
            if a1 is not None and a2 is not None:
                diff = a2 - a1
                if diff > 0.3:
                    elevation_gain += diff
                    
    # Generate merged workout
    merged_id = str(uuid.uuid4())
    
    # Check what sensors are present
    real_power = any(r["power"] is not None and r["power"] > 0 for r in merged_stream)
    has_hr = any(r["heart_rate"] is not None for r in merged_stream)
    
    workout = Workout(
        id=merged_id,
        title=req.title,
        timestamp=start_time,
        duration_seconds=duration,
        distance_meters=max_dist,
        average_power=calc.get("average_power"),
        max_power=calc.get("max_power"),
        average_hr=calc.get("average_hr"),
        max_hr=calc.get("max_hr"),
        average_cadence=calc.get("average_cadence"),
        total_elevation_gain=elevation_gain,
        calories=None,
        tss=calc.get("tss"),
        tss_type=calc.get("tss_type"),
        np=calc.get("np"),
        if_factor=calc.get("if_factor"),
        peak_20min_power=calc.get("peak_20min_power"),
        is_merged=True,
        real_power_present=real_power,
        estimated_power_present=False,
        hr_present=has_hr,
        source_file_ids=[req.file_id_1, req.file_id_2]
    )
    
    # Save stream
    stream_record = WorkoutStream(
        workout_id=merged_id,
        stream_data=merged_stream
    )
    
    try:
        # Delete original promoted workouts
        db.query(Workout).filter(Workout.id == req.file_id_1).delete()
        db.query(WorkoutStream).filter(WorkoutStream.workout_id == req.file_id_1).delete()
        
        db.query(Workout).filter(Workout.id == req.file_id_2).delete()
        db.query(WorkoutStream).filter(WorkoutStream.workout_id == req.file_id_2).delete()
        
        # Add new merged records
        db.add(workout)
        db.add(stream_record)
        
        # Update raw file statuses to merged
        f1.status = "merged"
        f2.status = "merged"
        
        db.commit()
        db.refresh(workout)
        return workout
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(e)}")

@app.post("/api/workouts/{workout_id}/attach-file", response_model=WorkoutListResponse)
async def attach_file_to_workout(
    workout_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads a FIT/GPX/TCX file (containing e.g. HR or Power data) and directly merges
    its sensor streams into an existing workout.
    """
    target_workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not target_workout:
        raise HTTPException(status_code=404, detail="Harjoitusta ei löytynyt.")

    ext = file.filename.split(".")[-1].lower().strip()
    if "fit" in ext or file.filename.lower().endswith(".fit"):
        ext = "fit"
    elif "tcx" in ext or file.filename.lower().endswith(".tcx"):
        ext = "tcx"
    elif "gpx" in ext or file.filename.lower().endswith(".gpx"):
        ext = "gpx"
    else:
        raise HTTPException(status_code=400, detail="Ei-tuettu tiedostomuoto. Käytä .fit, .tcx tai .gpx tiedostoa.")

    file_id = str(uuid.uuid4())
    raw_dir = os.path.join(settings.DATA_DIR, "raw")
    os.makedirs(raw_dir, exist_ok=True)
    
    filepath = os.path.join(raw_dir, f"{file_id}.{ext}")
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        parsed = parse_file(filepath)
        meta = parsed["meta"]
        new_stream = parsed["stream"] or []

        # Save RawFile record
        raw_file = RawFile(
            id=file_id,
            filename=file.filename,
            file_type=ext,
            upload_time=datetime.datetime.utcnow(),
            start_time=meta["start_time"],
            end_time=meta["end_time"],
            sensors_present=meta["sensors_present"],
            filepath=filepath,
            status="merged"
        )
        db.add(raw_file)

        # Get existing stream or initialize
        stream_rec = db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout_id).first()
        existing_stream = stream_rec.stream_data if stream_rec and stream_rec.stream_data else []

        if not existing_stream:
            merged_stream = new_stream
        else:
            existing_start = None
            new_start = None
            for r in existing_stream:
                ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r.get("timestamp")
                if ts:
                    existing_start = ts
                    break
            for r in new_stream:
                ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r.get("timestamp")
                if ts:
                    new_start = ts
                    break

            new_by_offset = {}
            for r in new_stream:
                ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r.get("timestamp")
                if ts and new_start:
                    sec_idx = int(round((ts - new_start).total_seconds()))
                    new_by_offset[sec_idx] = r

            existing_powers = [r.get("power") for r in existing_stream if isinstance(r, dict) and r.get("power") is not None and r.get("power") > 0]
            existing_hrs = [r.get("heart_rate") for r in existing_stream if isinstance(r, dict) and r.get("heart_rate") is not None and r.get("heart_rate") > 0]
            existing_power_is_flat = len(set(existing_powers)) <= 1
            existing_hr_is_flat = len(set(existing_hrs)) <= 1

            merged_stream = []
            for r in existing_stream:
                ts = parse_iso_datetime(r["timestamp"]) if isinstance(r["timestamp"], str) else r.get("timestamp")
                m_record = dict(r)
                if ts and existing_start:
                    sec_idx = int(round((ts - existing_start).total_seconds()))
                    match_r = None
                    for delta in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10):
                        if (sec_idx + delta) in new_by_offset:
                            match_r = new_by_offset[sec_idx + delta]
                            break

                    if match_r:
                        for key in ("heart_rate", "power", "cadence", "speed", "altitude"):
                            new_val = match_r.get(key)
                            curr_val = m_record.get(key)
                            is_flat = existing_power_is_flat if key == "power" else (existing_hr_is_flat if key == "heart_rate" else False)
                            if new_val is not None and new_val > 0 and (curr_val is None or curr_val == 0 or is_flat):
                                m_record[key] = new_val
                merged_stream.append(m_record)

        # Save stream
        if not stream_rec:
            stream_rec = WorkoutStream(workout_id=workout_id, stream_data=merged_stream)
            db.add(stream_rec)
        else:
            stream_rec.stream_data = merged_stream

        # Recalculate metrics
        params = get_user_params(db)
        calc = calculate_metrics_for_workout(
            merged_stream,
            ftp=params.ftp,
            lthr=params.lthr,
            resting_hr=params.resting_hr,
            max_hr=params.max_hr
        )

        has_power = any(r.get("power") is not None and r.get("power") > 0 for r in merged_stream)
        has_hr = any(r.get("heart_rate") is not None and r.get("heart_rate") > 0 for r in merged_stream)

        calc_avg_pwr = calc.get("average_power")
        if calc_avg_pwr is not None and calc_avg_pwr > 0:
            target_workout.average_power = calc_avg_pwr
        
        calc_np = calc.get("np")
        if calc_np is not None and calc_np > 0:
            target_workout.np = calc_np

        calc_max_pwr = calc.get("max_power")
        if calc_max_pwr is not None and calc_max_pwr > 0:
            target_workout.max_power = calc_max_pwr

        calc_avg_hr = calc.get("average_hr")
        if calc_avg_hr is not None and calc_avg_hr > 0:
            target_workout.average_hr = calc_avg_hr

        calc_max_hr = calc.get("max_hr")
        if calc_max_hr is not None and calc_max_hr > 0:
            target_workout.max_hr = calc_max_hr

        calc_cad = calc.get("average_cadence")
        if calc_cad is not None and calc_cad > 0:
            target_workout.average_cadence = calc_cad

        calc_tss = calc.get("tss")
        if calc_tss is not None and calc_tss > 0:
            target_workout.tss = calc_tss
            target_workout.tss_type = calc.get("tss_type") or target_workout.tss_type

        calc_if = calc.get("if_factor")
        if calc_if is not None and calc_if > 0:
            target_workout.if_factor = calc_if

        target_workout.is_merged = True
        if has_power:
            target_workout.real_power_present = True
        if has_hr:
            target_workout.hr_present = True

        src_ids = target_workout.source_file_ids or []
        if file_id not in src_ids:
            target_workout.source_file_ids = src_ids + [file_id]

        db.commit()
        db.refresh(target_workout)
        try:
            update_all_summaries(db)
        except Exception as e:
            print(f"Error updating summaries after attach: {e}")

        # Push the newly merged workout telemetry directly to central server
        try:
            push_workout_to_remote_server(target_workout, db)
        except Exception as e:
            print(f"Error pushing merged workout to remote server: {e}")

        return target_workout
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Tiedoston yhdistäminen epäonnistui: {str(e)}")

@app.get("/api/workouts/{workout_id}/source-files", response_model=List[RawFileResponse])
def get_workout_source_files(workout_id: str, db: Session = Depends(get_db)):
    """Returns the details of all raw files attached/merged into a workout session."""
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Harjoitusta ei löytynyt.")
    
    src_ids = workout.source_file_ids or []
    if not src_ids:
        src_ids = [workout.id]

    raw_files = db.query(RawFile).filter(RawFile.id.in_(src_ids)).all()
    return raw_files

@app.post("/api/workouts/{workout_id}/detach-file/{file_id}")
def detach_file_from_workout(workout_id: str, file_id: str, db: Session = Depends(get_db)):
    """
    Detaches a specific raw file (e.g. wrong HR FIT file) from a workout.
    Restores the raw file to status 'unmerged' and recalculates the workout from remaining source files.
    """
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Harjoitusta ei löytynyt.")
        
    src_ids = list(workout.source_file_ids or [])
    if file_id not in src_ids:
        raise HTTPException(status_code=400, detail="Tiedosto ei kuulu tähän harjoitukseen.")
        
    # Mark detached RawFile as unmerged
    raw_f = db.query(RawFile).filter(RawFile.id == file_id).first()
    if raw_f:
        raw_f.status = "unmerged"
        
        # Also create a standalone unmerged workout for this detached raw file if file exists on disk
        if os.path.exists(raw_f.filepath):
            try:
                parsed = parse_file(raw_f.filepath)
                params = get_user_params(db)
                has_real_power = "power" in parsed["meta"]["sensors_present"]
                if not has_real_power:
                    parsed["stream"] = estimate_stream_power(parsed["stream"], params)
                    
                calc = calculate_metrics_for_workout(
                    parsed["stream"],
                    ftp=params.ftp,
                    lthr=params.lthr,
                    resting_hr=params.resting_hr,
                    max_hr=params.max_hr
                )
                
                existing_orig = db.query(Workout).filter(Workout.id == file_id).first()
                if not existing_orig:
                    orig_workout = Workout(
                        id=file_id,
                        title=raw_f.filename,
                        timestamp=parsed["meta"]["start_time"] or raw_f.upload_time,
                        duration_seconds=parsed["meta"]["duration_seconds"],
                        distance_meters=parsed["meta"]["distance_meters"],
                        average_power=calc.get("average_power"),
                        max_power=calc.get("max_power"),
                        average_hr=calc.get("average_hr"),
                        max_hr=calc.get("max_hr"),
                        average_cadence=calc.get("average_cadence"),
                        total_elevation_gain=parsed["meta"]["total_elevation_gain"],
                        calories=parsed["meta"]["calories"],
                        tss=calc.get("tss"),
                        tss_type=calc.get("tss_type"),
                        np=calc.get("np"),
                        if_factor=calc.get("if_factor"),
                        is_merged=False,
                        real_power_present=has_real_power,
                        estimated_power_present=not has_real_power,
                        hr_present="hr" in parsed["meta"]["sensors_present"],
                        source_file_ids=[file_id]
                    )
                    db.add(orig_workout)
                    
                    orig_stream = WorkoutStream(
                        workout_id=file_id,
                        stream_data=parsed["stream"]
                    )
                    db.add(orig_stream)
            except Exception as e:
                print(f"Error restoring detached raw file workout: {e}")

    # Remove file_id from target workout
    remaining_ids = [fid for fid in src_ids if fid != file_id]
    workout.source_file_ids = remaining_ids

    if not remaining_ids:
        # If no files remain, delete workout and stream
        db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout_id).delete()
        db.delete(workout)
        db.commit()
        return {"status": "success", "message": "Kaikki tiedostot irrotettu. Harjoitus poistettu."}

    # Re-build telemetry stream and recalculate metrics for target_workout from remaining_ids
    remaining_streams = []
    for fid in remaining_ids:
        rf = db.query(RawFile).filter(RawFile.id == fid).first()
        if rf and os.path.exists(rf.filepath):
            try:
                p = parse_file(rf.filepath)
                remaining_streams.append(p["stream"])
            except Exception:
                pass

    if remaining_streams:
        base_stream = [dict(r) for r in remaining_streams[0]]
        for secondary in remaining_streams[1:]:
            s_by_offset = {int(round(r["time_offset"])): r for r in secondary if "time_offset" in r}
            for r in base_stream:
                off = int(round(r.get("time_offset", 0)))
                if off in s_by_offset:
                    match_r = s_by_offset[off]
                    for key in ("heart_rate", "power", "cadence", "speed", "altitude"):
                        if match_r.get(key) is not None and (r.get(key) is None or r.get(key) == 0):
                            r[key] = match_r[key]

        stream_rec = db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout_id).first()
        if stream_rec:
            stream_rec.stream_data = base_stream
        else:
            db.add(WorkoutStream(workout_id=workout_id, stream_data=base_stream))

        params = get_user_params(db)
        calc = calculate_metrics_for_workout(
            base_stream,
            ftp=params.ftp,
            lthr=params.lthr,
            resting_hr=params.resting_hr,
            max_hr=params.max_hr
        )

        has_pwr = any(r.get("power") is not None and r.get("power") > 0 for r in base_stream)
        has_hr = any(r.get("heart_rate") is not None and r.get("heart_rate") > 0 for r in base_stream)

        workout.average_power = calc.get("average_power")
        workout.np = calc.get("np")
        workout.max_power = calc.get("max_power")
        workout.average_hr = calc.get("average_hr")
        workout.max_hr = calc.get("max_hr")
        workout.average_cadence = calc.get("average_cadence")
        workout.tss = calc.get("tss")
        workout.tss_type = calc.get("tss_type")
        workout.if_factor = calc.get("if_factor")
        workout.is_merged = len(remaining_ids) > 1
        workout.real_power_present = has_pwr
        workout.hr_present = has_hr

    db.commit()
    db.refresh(workout)
    try:
        update_all_summaries(db)
    except Exception as e:
        print(f"Error updating summaries after detach: {e}")
    return {"status": "success", "message": "Tiedosto irrotettu harjoituksesta.", "workout": workout}

@app.post("/api/workouts/{workout_id}/unmerge")
def unmerge_entire_workout(workout_id: str, db: Session = Depends(get_db)):
    """
    Completely breaks apart a merged workout back into its separate raw files.
    """
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Harjoitusta ei löytynyt.")

    src_ids = list(workout.source_file_ids or [])
    if not src_ids:
        src_ids = [workout.id]

    for file_id in src_ids:
        raw_f = db.query(RawFile).filter(RawFile.id == file_id).first()
        if raw_f:
            raw_f.status = "unmerged"
            if os.path.exists(raw_f.filepath):
                try:
                    parsed = parse_file(raw_f.filepath)
                    params = get_user_params(db)
                    has_real_power = "power" in parsed["meta"]["sensors_present"]
                    if not has_real_power:
                        parsed["stream"] = estimate_stream_power(parsed["stream"], params)
                        
                    calc = calculate_metrics_for_workout(
                        parsed["stream"],
                        ftp=params.ftp,
                        lthr=params.lthr,
                        resting_hr=params.resting_hr,
                        max_hr=params.max_hr
                    )
                    
                    existing_orig = db.query(Workout).filter(Workout.id == file_id).first()
                    if not existing_orig:
                        orig_workout = Workout(
                            id=file_id,
                            title=raw_f.filename,
                            timestamp=parsed["meta"]["start_time"] or raw_f.upload_time,
                            duration_seconds=parsed["meta"]["duration_seconds"],
                            distance_meters=parsed["meta"]["distance_meters"],
                            average_power=calc.get("average_power"),
                            max_power=calc.get("max_power"),
                            average_hr=calc.get("average_hr"),
                            max_hr=calc.get("max_hr"),
                            average_cadence=calc.get("average_cadence"),
                            total_elevation_gain=parsed["meta"]["total_elevation_gain"],
                            calories=parsed["meta"]["calories"],
                            tss=calc.get("tss"),
                            tss_type=calc.get("tss_type"),
                            np=calc.get("np"),
                            if_factor=calc.get("if_factor"),
                            is_merged=False,
                            real_power_present=has_real_power,
                            estimated_power_present=not has_real_power,
                            hr_present="hr" in parsed["meta"]["sensors_present"],
                            source_file_ids=[file_id]
                        )
                        db.add(orig_workout)
                        
                        orig_stream = WorkoutStream(
                            workout_id=file_id,
                            stream_data=parsed["stream"]
                        )
                        db.add(orig_stream)
                except Exception as e:
                    print(f"Error unmerging file {file_id}: {e}")

    # Delete the merged workout and stream
    db.query(WorkoutStream).filter(WorkoutStream.workout_id == workout_id).delete()
    db.delete(workout)
    db.commit()
    try:
        update_all_summaries(db)
    except Exception as e:
        print(f"Error updating summaries after unmerge: {e}")

    return {"status": "success", "message": "Harjoituksen yhdistäminen purettu. Tiedostot palautettu omiksi harjoituksikseen."}


# --- Dashboard Summary ---

@app.get("/api/dashboard/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    workouts = db.query(Workout).order_by(Workout.timestamp.desc()).all()
    params = get_user_params(db)
    goal = get_user_goal(db)
    
    # Reverse to calculate chronologically
    workouts_list = [{"date": w.timestamp.date(), "tss": w.tss or 0.0} for w in reversed(workouts)]
    
    history = calculate_ctl_atl_tsb(workouts_list)
    
    ctl = 0.0
    atl = 0.0
    tsb = 0.0
    if history:
        ctl = history[-1]["ctl"]
        atl = history[-1]["atl"]
        tsb = history[-1]["tsb"]
        
    # Calculate weekly hours and load (last 7 days relative to latest workout or now)
    latest_ts = workouts[0].timestamp if workouts else datetime.datetime.utcnow()
    ref_now = max(datetime.datetime.utcnow(), latest_ts)
    seven_days_ago = ref_now - datetime.timedelta(days=7)
    weekly_workouts = [w for w in workouts if w.timestamp >= seven_days_ago]
    
    weekly_hours = sum(w.duration_seconds for w in weekly_workouts) / 3600.0
    weekly_load = sum(w.tss for w in weekly_workouts if w.tss)
    
    # Calculate Goal progress
    # e.g., weekly workouts / weekly capacity hours
    goal_progress = 0.0
    if goal.weekly_capacity_hours > 0:
        goal_progress = min(100.0, (weekly_hours / goal.weekly_capacity_hours) * 100.0)
        
    # Calculate season aggregates
    season_distance_km = sum(w.distance_meters for w in workouts if w.distance_meters) / 1000.0
    season_ascent_m = sum(w.total_elevation_gain for w in workouts if w.total_elevation_gain)
    
    # Calculate estimated FTP (eFTP) from peak 20-min power
    max_p20 = 0.0
    for w in workouts:
        p20 = w.peak_20min_power
        if p20 is None and w.real_power_present:
            s = db.query(WorkoutStream).filter(WorkoutStream.workout_id == w.id).first()
            if s:
                curve = calculate_power_duration_curve_for_stream(s.stream_data)
                p20 = curve.get(1200, 0.0)
                w.peak_20min_power = p20
                try:
                    db.commit()
                except Exception:
                    db.rollback()
        if p20 and p20 > max_p20:
            max_p20 = p20
            
    eftp = max_p20 * 0.95 if max_p20 > 0 else params.ftp
    
    # Calculate peak VAM
    peak_vam = 0.0
    for w in workouts:
        if w.duration_seconds > 300 and w.total_elevation_gain and w.total_elevation_gain > 20:
            val = w.total_elevation_gain / (w.duration_seconds / 3600.0)
            if val > peak_vam:
                peak_vam = val

    return {
        "ctl": ctl,
        "atl": atl,
        "tsb": tsb,
        "weekly_load": weekly_load,
        "weekly_hours": weekly_hours,
        "weekly_capacity": goal.weekly_capacity_hours,
        "goal_progress_percent": goal_progress,
        "recent_workouts": workouts,  # Return all workouts for frontend filtering and pagination
        "season_distance_km": season_distance_km,
        "season_ascent_m": season_ascent_m,
        "eftp": eftp,
        "cp": params.cp if (params.cp and params.cp > 0) else (params.ftp or 200.0),
        "w_prime": params.w_prime if (params.w_prime and params.w_prime > 0) else 20000.0,
        "peak_vam": peak_vam
    }

@app.get("/api/dashboard/charts")
def get_dashboard_charts(db: Session = Depends(get_db)):
    """Returns historical list of daily ctl/atl/tsb for Recharts strictly up to actual workouts."""
    workouts = db.query(Workout).order_by(Workout.timestamp.asc()).all()
    workouts_list = [{"date": w.timestamp.date(), "tss": w.tss or 0.0} for w in workouts]
    return calculate_ctl_atl_tsb(workouts_list)

@app.get("/api/dashboard/weekly-load")
def get_weekly_load(db: Session = Depends(get_db)):
    """Returns load (TSS) and distance (km) aggregated by week for the last 12 weeks."""
    latest = db.query(Workout.timestamp).order_by(Workout.timestamp.desc()).first()
    ref_now = latest[0] if latest else datetime.datetime.utcnow()
    now = max(datetime.datetime.utcnow(), ref_now)
    start_date = now - datetime.timedelta(weeks=12)
    workouts = db.query(Workout).filter(Workout.timestamp >= start_date).all()
    
    weeks_data = []
    for i in range(12):
        w_start = start_date + datetime.timedelta(weeks=i)
        w_end = w_start + datetime.timedelta(days=7)
        w_workouts = [w for w in workouts if w_start <= w.timestamp < w_end]
        
        tss_sum = sum(w.tss for w in w_workouts if w.tss)
        dist_sum = sum(w.distance_meters for w in w_workouts if w.distance_meters) / 1000.0
        
        weeks_data.append({
            "week_label": f"Vko {w_start.isocalendar()[1]}",
            "tss": float(tss_sum),
            "distance": float(dist_sum)
        })
        
    for idx, w_data in enumerate(weeks_data):
        prev_4 = weeks_data[max(0, idx-3):idx+1]
        avg_tss = sum(x["tss"] for x in prev_4) / len(prev_4)
        w_data["avg_tss"] = float(avg_tss)
        
    return weeks_data

@app.get("/api/dashboard/ftp-history")
def get_ftp_history(db: Session = Depends(get_db)):
    """Returns timeline of eFTP estimates for each workout."""
    workouts = db.query(Workout).order_by(Workout.timestamp.asc()).all()
    params = get_user_params(db)
    history = []
    running_eftp = params.ftp
    
    for w in workouts:
        p20 = w.peak_20min_power
        if p20 and p20 > 0:
            running_eftp = p20 * 0.95
        w_kg = running_eftp / params.weight_kg if params.weight_kg > 0 else 0.0
        history.append({
            "date": w.timestamp.strftime("%Y-%m-%d"),
            "title": w.title or "Nimetön harjoitus",
            "eftp": float(round(running_eftp, 1)),
            "w_kg": float(round(w_kg, 2))
        })
        
    return history

@app.get("/api/dashboard/scatter")
def get_dashboard_scatter(db: Session = Depends(get_db)):
    """
    Returns data points for Heart Rate vs. Power Scatter Plot & Efficiency Heatmap across all workouts.
    Includes average_power, np, average_hr, max_hr, ef, vi, tss, aerobic_decoupling, date, title.
    """
    workouts = db.query(Workout).filter(
        Workout.average_hr.isnot(None),
        Workout.average_hr > 0
    ).order_by(Workout.timestamp.asc()).all()
    
    scatter_points = []
    for w in workouts:
        avg_p = w.average_power or w.np or 0.0
        if avg_p > 0 and w.average_hr and w.average_hr > 0:
            ef_val = float(w.ef) if w.ef else round(float(w.np or avg_p) / float(w.average_hr), 2)
            scatter_points.append({
                "id": w.id,
                "date": w.timestamp.strftime("%Y-%m-%d"),
                "title": w.title or "Harjoitus",
                "avg_power": round(float(avg_p), 1),
                "np": round(float(w.np or avg_p), 1),
                "avg_hr": round(float(w.average_hr), 1),
                "max_hr": int(w.max_hr) if w.max_hr else None,
                "ef": ef_val,
                "vi": round(float(w.vi), 2) if w.vi else 1.0,
                "aerobic_decoupling": round(float(w.aerobic_decoupling), 1) if w.aerobic_decoupling is not None else None,
                "tss": round(float(w.tss or 0.0), 1),
                "duration_min": round(float(w.duration_seconds or 0.0) / 60.0, 1),
                "is_estimated_power": bool(w.estimated_power_present and not w.real_power_present)
            })
            
    return scatter_points

@app.get("/api/dashboard/heatmap")
def get_dashboard_heatmap(db: Session = Depends(get_db)):
    """
    Returns monthly and daily training load matrix for Heatmap visualization.
    """
    workouts = db.query(Workout).order_by(Workout.timestamp.asc()).all()
    
    daily_map = {}
    monthly_map = {}
    
    for w in workouts:
        if not w.timestamp:
            continue
        date_str = w.timestamp.strftime("%Y-%m-%d")
        month_str = w.timestamp.strftime("%Y-%m")
        tss = float(w.tss or 0.0)
        dur_h = float(w.duration_seconds or 0.0) / 3600.0
        np_val = float(w.np or w.average_power or 0.0)
        ef_val = float(w.ef or 0.0)
        
        # Daily
        if date_str not in daily_map:
            daily_map[date_str] = {"date": date_str, "tss": 0.0, "duration_hours": 0.0, "count": 0, "max_np": 0.0}
        daily_map[date_str]["tss"] += tss
        daily_map[date_str]["duration_hours"] += dur_h
        daily_map[date_str]["count"] += 1
        daily_map[date_str]["max_np"] = max(daily_map[date_str]["max_np"], np_val)
        
        # Monthly
        if month_str not in monthly_map:
            monthly_map[month_str] = {
                "month": month_str,
                "total_tss": 0.0,
                "total_duration_hours": 0.0,
                "count": 0,
                "np_sum": 0.0,
                "ef_sum": 0.0,
                "ef_count": 0
            }
        monthly_map[month_str]["total_tss"] += tss
        monthly_map[month_str]["total_duration_hours"] += dur_h
        monthly_map[month_str]["count"] += 1
        if np_val > 0:
            monthly_map[month_str]["np_sum"] += np_val
        if ef_val > 0:
            monthly_map[month_str]["ef_sum"] += ef_val
            monthly_map[month_str]["ef_count"] += 1
            
    monthly_list = []
    for m in sorted(monthly_map.keys()):
        item = monthly_map[m]
        count = item["count"]
        ef_cnt = item["ef_count"]
        monthly_list.append({
            "month": m,
            "total_tss": round(item["total_tss"], 1),
            "total_duration_hours": round(item["total_duration_hours"], 1),
            "workout_count": count,
            "avg_np": round(item["np_sum"] / count, 1) if count > 0 else 0.0,
            "avg_ef": round(item["ef_sum"] / ef_cnt, 2) if ef_cnt > 0 else 0.0
        })
        
    daily_list = []
    for d in sorted(daily_map.keys()):
        item = daily_map[d]
        tss = item["tss"]
        # Level 0-4
        level = 0
        if tss > 0 and tss <= 30:
            level = 1
        elif tss > 30 and tss <= 70:
            level = 2
        elif tss > 70 and tss <= 120:
            level = 3
        elif tss > 120:
            level = 4
        daily_list.append({
            "date": d,
            "tss": round(tss, 1),
            "duration_hours": round(item["duration_hours"], 1),
            "count": item["count"],
            "max_np": round(item["max_np"], 1),
            "level": level
        })
        
    return {
        "monthly": monthly_list,
        "daily": daily_list
    }


@app.get("/api/coach/summary")
def get_coach_summary(db: Session = Depends(get_db)):
    """Generates an automated text summary of training status and advice."""
    params = get_user_params(db)
    prompt = "Anna tiivis, asiantunteva ja kannustava katsaus (noin 3 virkettä) nykyisestä harjoituskuormastani (CTL, ATL, TSB). Kerro selkeästi tuleeko minun ottaa lepopäivä, jatkaa kehittävää harjoittelua tai keventää viikkoa."
    if params.language != "fi":
        prompt = "Provide a concise, expert and encouraging review (about 3 sentences) of my current training load (CTL, ATL, TSB). Clearly state whether I should take a rest day, continue progressive training, or schedule a recovery week."
        
    system_instruction = {
        "role": "user",
        "content": prompt
    }
    
    try:
        reply = generate_coaching_response([system_instruction], db)
        return {"summary": reply}
    except Exception as e:
        return {"summary": f"Katsauksen haku epäonnistui: {str(e)}"}

@app.post("/api/coach/chat", response_model=ChatResponse)
def coach_chat(req: ChatRequest, db: Session = Depends(get_db)):
    # Convert ChatMessage schema to dict list
    dict_messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]
    
    try:
        reply = generate_coaching_response(dict_messages, db)
        return {"response": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Coaching assistant error: {str(e)}")


# --- Suunto & Garmin Connect Support Helpers ---

def get_suunto_file_meta(filepath: str):
    filename = os.path.basename(filepath)
    size_bytes = os.path.getsize(filepath)
    try:
        fitfile = fitparse.FitFile(filepath)
        start_time = None
        end_time = None
        has_hr = False
        has_power = False
        has_cadence = False
        
        for record in fitfile.get_messages("record"):
            values = record.get_values()
            ts = values.get("timestamp")
            if ts:
                if start_time is None or ts < start_time:
                    start_time = ts
                if end_time is None or ts > end_time:
                    end_time = ts
            if values.get("heart_rate") is not None:
                has_hr = True
            if values.get("power") is not None:
                has_power = True
            if values.get("cadence") is not None:
                has_cadence = True
                
        duration = 0.0
        if start_time and end_time:
            duration = (end_time - start_time).total_seconds()
            
        return {
            "filename": filename,
            "size_bytes": size_bytes,
            "start_time": start_time.isoformat() if start_time else None,
            "end_time": end_time.isoformat() if end_time else None,
            "duration_seconds": duration,
            "has_hr": has_hr,
            "has_power": has_power,
            "has_cadence": has_cadence
        }
    except Exception as e:
        return {
            "filename": filename,
            "size_bytes": size_bytes,
            "start_time": None,
            "end_time": None,
            "duration_seconds": 0.0,
            "has_hr": False,
            "has_power": False,
            "has_cadence": False,
            "error": str(e)
        }

def align_suunto_stream_with_garmin(
    suunto_stream: list[dict],
    garmin_start_utc: datetime.datetime,
    garmin_duration_seconds: float,
    garmin_avg_power: Optional[float],
    garmin_max_power: Optional[float],
    garmin_avg_cadence: Optional[float],
    garmin_max_cadence: Optional[float],
    garmin_distance_meters: Optional[float]
) -> list[dict]:
    suunto_by_ts = {}
    for r in suunto_stream:
        ts_str = r["timestamp"]
        if isinstance(ts_str, str):
            ts = parse_iso_datetime(ts_str)
        else:
            ts = ts_str
        if ts:
            ts_rounded = ts.replace(microsecond=0)
            suunto_by_ts[ts_rounded] = r
            
    aligned = []
    duration_int = int(garmin_duration_seconds)
    if duration_int <= 0:
        duration_int = 1
        
    for t in range(duration_int):
        curr_ts = garmin_start_utc + datetime.timedelta(seconds=t)
        
        match_r = None
        for diff in [0, 1, -1, 2, -2, 3, -3]:
            check_ts = curr_ts + datetime.timedelta(seconds=diff)
            if check_ts in suunto_by_ts:
                match_r = suunto_by_ts[check_ts]
                break
                
        rec = {
            "timestamp": curr_ts.isoformat(),
            "time_offset": float(t),
            "heart_rate": match_r["heart_rate"] if match_r else None,
            "power": match_r.get("power") if match_r else None,
            "cadence": match_r.get("cadence") if match_r else None,
            "speed": match_r.get("speed") if match_r else None,
            "altitude": match_r.get("altitude") if match_r else None,
            "distance": match_r.get("distance") if match_r else None,
            "lat": match_r.get("lat") if match_r else None,
            "lon": match_r.get("lon") if match_r else None
        }
        aligned.append(rec)
        
    last_hr = None
    for r in aligned:
        if r["heart_rate"] is not None:
            last_hr = r["heart_rate"]
        else:
            r["heart_rate"] = last_hr
            
    first_hr = None
    for r in aligned:
        if r["heart_rate"] is not None:
            first_hr = r["heart_rate"]
            break
    if first_hr is not None:
        for r in aligned:
            if r["heart_rate"] is None:
                r["heart_rate"] = first_hr
            else:
                break
                
    has_power = any(r["power"] is not None for r in aligned)
    if not has_power and garmin_avg_power is not None and garmin_avg_power > 0:
        hrs = [r["heart_rate"] for r in aligned if r["heart_rate"] is not None]
        if hrs:
            min_h = min(hrs)
            max_h = max(hrs)
            h_span = max_h - min_h
            if h_span <= 0:
                h_span = 1
            
            raw_powers = []
            for r in aligned:
                if r["heart_rate"] is not None:
                    hr_frac = (r["heart_rate"] - min_h) / h_span
                    p_val = garmin_avg_power * (0.6 + 0.8 * hr_frac)
                else:
                    p_val = garmin_avg_power
                raw_powers.append(p_val)
                
            avg_raw = sum(raw_powers) / len(raw_powers) if raw_powers else 0.0
            scale = garmin_avg_power / avg_raw if avg_raw > 0 else 1.0
            
            for idx, r in enumerate(aligned):
                p_val = raw_powers[idx] * scale
                if garmin_max_power is not None:
                    p_val = min(p_val, garmin_max_power)
                r["power"] = round(p_val, 1)
        else:
            for r in aligned:
                r["power"] = float(garmin_avg_power)
                
    has_cadence = any(r["cadence"] is not None for r in aligned)
    if not has_cadence and garmin_avg_cadence is not None and garmin_avg_cadence > 0:
        import random
        curr_cad = garmin_avg_cadence
        for r in aligned:
            if r.get("power") is not None and r["power"] < 10:
                r["cadence"] = 0
            else:
                max_cad = garmin_max_cadence or (garmin_avg_cadence + 15)
                step = random.choice([-2, -1, 0, 1, 2])
                curr_cad = max(garmin_avg_cadence - 10, min(garmin_avg_cadence + 10, curr_cad + step))
                curr_cad = max(0, min(max_cad, curr_cad))
                r["cadence"] = int(curr_cad)
                
    has_speed = any(r["speed"] is not None for r in aligned)
    if not has_speed and garmin_distance_meters is not None and garmin_distance_meters > 0:
        avg_speed = garmin_distance_meters / garmin_duration_seconds
        for idx, r in enumerate(aligned):
            r["speed"] = round(avg_speed, 3)
            r["distance"] = round(avg_speed * idx, 1)
            
    return aligned


# --- Suunto File API Endpoints ---

@app.get("/api/suunto/files")
def list_suunto_files():
    suunto_dir = os.path.join(settings.DATA_DIR, "suunto")
    os.makedirs(suunto_dir, exist_ok=True)
    files = []
    for f in os.listdir(suunto_dir):
        if "fit" in f.lower() and os.path.isfile(os.path.join(suunto_dir, f)):
            files.append(get_suunto_file_meta(os.path.join(suunto_dir, f)))
    files.sort(key=lambda x: x.get("start_time") or "", reverse=True)
    return files

@app.post("/api/suunto/upload")
async def upload_suunto_file(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1].lower()
    if ext != "fit":
        raise HTTPException(status_code=400, detail="Vain .fit-tiedostot ovat tuettuja Suunto-kansioon.")
        
    suunto_dir = os.path.join(settings.DATA_DIR, "suunto")
    os.makedirs(suunto_dir, exist_ok=True)
    
    safe_name = os.path.basename(file.filename)
    filepath = os.path.join(suunto_dir, safe_name)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        fitfile = fitparse.FitFile(filepath)
        messages = list(fitfile.get_messages("record"))
        if not messages:
            raise ValueError("Tiedosto ei sisällä tietuetietoja (records).")
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Virheellinen FIT-tiedosto: {str(e)}")
        
    return {"status": "success", "file": get_suunto_file_meta(filepath)}

@app.delete("/api/suunto/files/{filename}")
def delete_suunto_file(filename: str):
    suunto_dir = os.path.join(settings.DATA_DIR, "suunto")
    safe_name = os.path.basename(filename)
    filepath = os.path.join(suunto_dir, safe_name)
    
    if not os.path.exists(filepath):
        merged_filepath = os.path.join(suunto_dir, "merged", safe_name)
        if os.path.exists(merged_filepath):
            filepath = merged_filepath
        else:
            raise HTTPException(status_code=404, detail="Tiedostoa ei löydy.")
        
    try:
        os.remove(filepath)
        return {"status": "success", "message": f"Tiedosto {safe_name} poistettu."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Poisto epäonnistui: {str(e)}")


# --- Garmin & Suunto Merge API Endpoint ---

@app.post("/api/workouts/import-garmin-suunto")
async def import_garmin_suunto(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import json
    from typing import Optional
    try:
        contents = await file.read()
        data = json.loads(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Virheellinen JSON-tiedosto: {str(e)}")
        
    activities = []
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                if "summarizedActivitiesExport" in item:
                    activities.extend(item["summarizedActivitiesExport"])
                else:
                    activities.append(item)
    elif isinstance(data, dict):
        if "summarizedActivitiesExport" in data:
            activities = data["summarizedActivitiesExport"]
        else:
            activities = [data]
            
    if not activities:
        raise HTTPException(status_code=400, detail="Ei Garmin-harjoituksia löydetty tiedostosta.")
        
    suunto_dir = os.path.join(settings.DATA_DIR, "suunto")
    os.makedirs(suunto_dir, exist_ok=True)
    merged_suunto_dir = os.path.join(suunto_dir, "merged")
    os.makedirs(merged_suunto_dir, exist_ok=True)
    
    suunto_files = []
    seen_start_times = set()
    for f in os.listdir(suunto_dir):
        fpath = os.path.join(suunto_dir, f)
        if "fit" in f.lower() and os.path.isfile(fpath):
            meta = get_suunto_file_meta(fpath)
            st = meta.get("start_time")
            if st:
                if st in seen_start_times:
                    try:
                        shutil.move(fpath, os.path.join(merged_suunto_dir, f))
                    except Exception:
                        pass
                    continue
                seen_start_times.add(st)
                meta["filepath"] = fpath
                meta["parsed_start_time"] = datetime.datetime.fromisoformat(st)
                suunto_files.append(meta)
                
    imported_count = 0
    duplicates_count = 0
    details = []
    
    params = get_user_params(db)
    
    for act in activities:
        act_type = act.get("activityType", "")
        sport_type = act.get("sportType", "")
        if "CYCLING" not in sport_type and "indoor_cycling" not in act_type and "virtual_ride" not in act_type:
            continue
                
        begin_ts_ms = act.get("beginTimestamp")
        if not begin_ts_ms:
            continue
            
        garmin_start_utc = datetime.datetime.fromtimestamp(begin_ts_ms / 1000.0, datetime.timezone.utc).replace(tzinfo=None)
        
        garmin_duration_ms = act.get("duration") or act.get("elapsedDuration") or 0.0
        garmin_duration_seconds = garmin_duration_ms / 1000.0
        if garmin_duration_seconds <= 0:
            continue
            
        garmin_distance_cm = act.get("distance") or 0.0
        garmin_distance_meters = garmin_distance_cm / 100.0
        
        title = act.get("name") or "Slope Workout"
        avg_p = act.get("avgPower")
        max_p = act.get("maxPower")
        avg_cad = act.get("avgBikeCadence")
        max_cad = act.get("maxBikeCadence")
        calories = act.get("calories")
        
        time_delta = datetime.timedelta(seconds=10)
        existing = db.query(Workout).filter(
            Workout.timestamp >= garmin_start_utc - time_delta,
            Workout.timestamp <= garmin_start_utc + time_delta,
            Workout.duration_seconds >= garmin_duration_seconds - 10,
            Workout.duration_seconds <= garmin_duration_seconds + 10
        ).first()
        
        if existing:
            duplicates_count += 1
            details.append({
                "title": title,
                "timestamp": garmin_start_utc.isoformat(),
                "status": "skipped_duplicate",
                "merged_with_suunto": False,
                "suunto_file": None
            })
            continue
            
        best_match = None
        min_diff = 7200.0
        
        for sf in suunto_files:
            diff = abs((sf["parsed_start_time"] - garmin_start_utc).total_seconds())
            if diff < min_diff:
                min_diff = diff
                best_match = sf
                
        workout_id = str(uuid.uuid4())
        merged_stream = []
        has_suunto_hr = False
        matched_suunto_file = None
        
        if best_match:
            try:
                parsed_suunto = parse_fit_file(best_match["filepath"])
                suunto_stream = parsed_suunto["stream"]
                
                merged_stream = align_suunto_stream_with_garmin(
                    suunto_stream,
                    garmin_start_utc,
                    garmin_duration_seconds,
                    avg_p,
                    max_p,
                    avg_cad,
                    max_cad,
                    garmin_distance_meters
                )
                
                has_suunto_hr = any(r["heart_rate"] is not None for r in merged_stream)
                matched_suunto_file = best_match["filename"]
                
                suunto_files.remove(best_match)
                shutil.move(best_match["filepath"], os.path.join(merged_suunto_dir, best_match["filename"]))
                
            except Exception as parse_err:
                print(f"Failed to merge with Suunto file {best_match['filename']}: {str(parse_err)}")
                merged_stream = []
                
        if not merged_stream:
            avg_speed = garmin_distance_meters / garmin_duration_seconds
            for t in range(int(garmin_duration_seconds)):
                curr_ts = garmin_start_utc + datetime.timedelta(seconds=t)
                merged_stream.append({
                    "timestamp": curr_ts.isoformat(),
                    "time_offset": float(t),
                    "heart_rate": None,
                    "power": float(avg_p) if avg_p is not None else 0.0,
                    "cadence": int(avg_cad) if avg_cad is not None else 0,
                    "speed": round(avg_speed, 3),
                    "altitude": 0.0,
                    "distance": round(avg_speed * t, 1),
                    "lat": None,
                    "lon": None
                })
                
        norm_power = act.get("normPower")
        tss = act.get("trainingStressScore")
        if_factor = act.get("intensityFactor")
        
        if not tss or not norm_power or not if_factor:
            calc = calculate_metrics_for_workout(
                merged_stream,
                ftp=params.ftp,
                lthr=params.lthr,
                resting_hr=params.resting_hr,
                max_hr=params.max_hr
            )
            if not norm_power:
                norm_power = calc.get("np")
            if not tss:
                tss = calc.get("tss")
            if not if_factor:
                if_factor = calc.get("if_factor")
                
        hrs_list = [r["heart_rate"] for r in merged_stream if r["heart_rate"] is not None]
        avg_hr = float(np.mean(hrs_list)) if hrs_list else None
        max_hr_val = int(np.max(hrs_list)) if hrs_list else None
        
        workout = Workout(
            id=workout_id,
            title=title,
            timestamp=garmin_start_utc,
            duration_seconds=garmin_duration_seconds,
            distance_meters=garmin_distance_meters,
            average_power=float(avg_p) if avg_p is not None else None,
            max_power=float(max_p) if max_p is not None else None,
            average_hr=avg_hr,
            max_hr=max_hr_val,
            average_cadence=float(avg_cad) if avg_cad is not None else None,
            total_elevation_gain=(act.get("elevationGain") or 0.0) / 100.0,
            calories=float(calories) if calories is not None else None,
            tss=float(tss) if tss is not None else None,
            tss_type="power" if avg_p else ("hr" if avg_hr else "estimated"),
            np=float(norm_power) if norm_power is not None else None,
            if_factor=float(if_factor) if if_factor is not None else None,
            is_merged=True if matched_suunto_file else False,
            real_power_present=True if avg_p and avg_p > 0 else False,
            estimated_power_present=False if avg_p and avg_p > 0 else True,
            hr_present=has_suunto_hr,
            source_file_ids=[f"garmin_activity_{act.get('activityId')}"] + ([matched_suunto_file] if matched_suunto_file else [])
        )
        
        stream_record = WorkoutStream(
            workout_id=workout_id,
            stream_data=merged_stream
        )
        
        db.add(workout)
        db.add(stream_record)
        imported_count += 1
        
        details.append({
            "title": title,
            "timestamp": garmin_start_utc.isoformat(),
            "status": "imported",
            "merged_with_suunto": True if matched_suunto_file else False,
            "suunto_file": matched_suunto_file
        })
        
    if imported_count > 0:
        db.commit()
        
    return {
        "status": "success",
        "imported_count": imported_count,
        "duplicates_count": duplicates_count,
        "details": details
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
