#!/usr/bin/env python3
"""
merge_suunto_workouts.py
------------------------
Reads Suunto FIT files from /Users/kari/Downloads/oma820/workouts/*.fit
Matches them by timestamp with existing workouts in backend/data/trainer.db.
Merges Heart Rate (HR) streams into existing streams, OR generates complete streams
for workouts missing stream data in workout_streams table.
Recalculates exact TSS, NP, IF, VI, EF (Efficiency Factor), Max HR, Aerobic Decoupling,
and W'bal balance, then updates trainer.db and syncs to server.
"""

import os
import sys
import json
import glob
import sqlite3
import datetime
from datetime import timedelta
import fitparse
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.metrics import (
    calculate_metrics_for_workout,
    calculate_normalized_power
)
from sync_workouts import sync as sync_to_server

DB_PATH = os.path.join(BASE_DIR, "backend", "data", "trainer.db")
SUUNTO_WORKOUTS_DIR = "/Users/kari/Downloads/oma820/workouts"

def parse_datetime(dt_str):
    if not dt_str:
        return None
    dt_str = dt_str.replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return None

def parse_filename_datetime(filename):
    """Extracts datetime from filename like 2026-05-18_07.05.22-indoor_cycling.fit"""
    try:
        base = os.path.basename(filename)
        parts = base.split("-")
        if len(parts) >= 3:
            full_str = "-".join(parts[0:3])  # '2026-05-18_07.05.22'
            return datetime.datetime.strptime(full_str, "%Y-%m-%d_%H.%M.%S")
    except Exception:
        pass
    return None

def get_ftp_from_db(conn):
    try:
        cur = conn.cursor()
        cur.execute("SELECT ftp, lthr, resting_hr, max_hr, cp, w_prime, weight_kg FROM user_parameters LIMIT 1")
        row = cur.fetchone()
        if row:
            return {
                "ftp": float(row[0] or 207.0),
                "lthr": int(row[1] or 165),
                "resting_hr": int(row[2] or 50),
                "max_hr": int(row[3] or 190),
                "cp": float(row[4] or 207.0),
                "w_prime": float(row[5] or 20000.0),
                "weight_kg": float(row[6] or 75.0)
            }
    except Exception as e:
        print(f"Warning: Could not fetch user parameters: {e}")
    return {
        "ftp": 207.0, "lthr": 165, "resting_hr": 50,
        "max_hr": 190, "cp": 207.0, "w_prime": 20000.0, "weight_kg": 75.0
    }

def read_suunto_fit_file(filepath):
    """Parses a Suunto FIT file and extracts start_time, duration, and timestamped records."""
    try:
        fitfile = fitparse.FitFile(filepath)
        records = []
        start_time = None
        end_time = None
        
        for record in fitfile.get_messages("record"):
            values = record.get_values()
            ts = values.get("timestamp")
            if not ts:
                continue
            if start_time is None or ts < start_time:
                start_time = ts
            if end_time is None or ts > end_time:
                end_time = ts
                
            hr = values.get("heart_rate")
            pwr = values.get("power")
            cad = values.get("cadence")
            spd = values.get("speed")
            alt = values.get("altitude")
            lat = values.get("position_lat")
            lon = values.get("position_long")
            if lat is not None:
                lat = lat * (180.0 / 2147483648.0)
            if lon is not None:
                lon = lon * (180.0 / 2147483648.0)
                
            records.append({
                "timestamp": ts,
                "heart_rate": int(hr) if hr is not None else None,
                "power": float(pwr) if pwr is not None else None,
                "cadence": int(cad) if cad is not None else None,
                "speed": float(spd) if spd is not None else None,
                "altitude": float(alt) if alt is not None else None,
                "lat": lat,
                "lon": lon
            })
            
        if not records or start_time is None:
            return None
            
        duration = (end_time - start_time).total_seconds()
        hrs = [r["heart_rate"] for r in records if r["heart_rate"] is not None]
        
        return {
            "filepath": filepath,
            "filename": os.path.basename(filepath),
            "start_time": start_time,
            "end_time": end_time,
            "duration_seconds": duration,
            "records": records,
            "has_hr": len(hrs) > 0,
            "avg_hr": float(np.mean(hrs)) if hrs else None,
            "max_hr": int(np.max(hrs)) if hrs else None
        }
    except Exception as e:
        return None

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        sys.exit(1)
        
    if not os.path.exists(SUUNTO_WORKOUTS_DIR):
        print(f"Error: Suunto directory not found at {SUUNTO_WORKOUTS_DIR}")
        sys.exit(1)
        
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    user_params = get_ftp_from_db(conn)
    print(f"User parameters loaded: FTP = {user_params['ftp']} W, LTHR = {user_params['lthr']} bpm")
    
    # Fast index Suunto FIT files by filename timestamp
    fit_paths = glob.glob(os.path.join(SUUNTO_WORKOUTS_DIR, "*.fit"))
    print(f"Indexing {len(fit_paths)} Suunto FIT files from {SUUNTO_WORKOUTS_DIR}...")
    
    fit_index = []
    for fp in fit_paths:
        dt = parse_filename_datetime(fp)
        if dt:
            fit_index.append({"filepath": fp, "filename": os.path.basename(fp), "approx_dt": dt})
            
    print(f"Indexed {len(fit_index)} FIT files with timestamps.")
    
    # Query database workouts
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workouts")
    db_workouts = [dict(w) for w in cursor.fetchall()]
    print(f"Found {len(db_workouts)} workouts in database.")
    
    merged_count = 0
    created_streams_count = 0
    
    for w in db_workouts:
        w_id = w["id"]
        w_title = w["title"]
        w_ts_str = w["timestamp"]
        w_duration = float(w["duration_seconds"] or 0.0)
        db_start = parse_datetime(w_ts_str)
        
        if not db_start:
            continue
            
        # Fast filter candidates within +- 15 minutes (900 seconds)
        candidates = []
        for fi in fit_index:
            diff = abs((fi["approx_dt"] - db_start).total_seconds())
            if diff <= 900.0:
                candidates.append((diff, fi))
                
        if not candidates:
            continue
            
        candidates.sort(key=lambda x: x[0])
        
        # Try parsing closest FIT file candidate
        best_match = None
        for diff, fi in candidates:
            parsed = read_suunto_fit_file(fi["filepath"])
            if parsed and parsed["has_hr"]:
                best_match = parsed
                actual_diff = abs((parsed["start_time"] - db_start).total_seconds())
                break
                
        if not best_match:
            continue
            
        # Fetch stream from workout_streams
        cursor.execute("SELECT stream_data FROM workout_streams WHERE workout_id = ?", (w_id,))
        stream_row = cursor.fetchone()
        
        existing_stream_data = None
        if stream_row and stream_row["stream_data"]:
            try:
                existing_stream_data = json.loads(stream_row["stream_data"])
            except Exception:
                existing_stream_data = None
                
        suunto_by_ts = {}
        for r in best_match["records"]:
            ts_rounded = r["timestamp"].replace(microsecond=0)
            suunto_by_ts[ts_rounded] = r
            
        updated_stream = []
        
        if existing_stream_data:
            # Case A: Stream already exists in DB -> Align Suunto HR into existing stream
            for idx, item in enumerate(existing_stream_data):
                time_offset = int(item.get("time_offset", idx))
                item_ts = db_start + timedelta(seconds=time_offset)
                item_ts_rounded = item_ts.replace(microsecond=0)
                
                match_r = None
                for offset_sec in [0, 1, -1, 2, -2, 3, -3]:
                    check_ts = item_ts_rounded + timedelta(seconds=offset_sec)
                    if check_ts in suunto_by_ts:
                        match_r = suunto_by_ts[check_ts]
                        break
                        
                if match_r and match_r["heart_rate"] is not None:
                    item["heart_rate"] = match_r["heart_rate"]
                elif "heart_rate" not in item:
                    item["heart_rate"] = None
                    
                updated_stream.append(item)
        else:
            # Case B: Stream is MISSING in DB -> Construct full stream from Suunto FIT + DB workout average power
            created_streams_count += 1
            print(f"\n[STREAM GENERATION] DB Workout '{w_title}' ({w_ts_str}) <--> Suunto '{best_match['filename']}'")
            
            duration_int = int(w_duration) if w_duration > 0 else int(best_match["duration_seconds"])
            if duration_int <= 0:
                duration_int = 1
                
            ftp = user_params["ftp"] or 207.0
            lthr = user_params["lthr"] or 165
            resting_hr = user_params["resting_hr"] or 50
            hr_range = lthr - resting_hr if (lthr - resting_hr) > 0 else 115
            default_pwr = float(w["average_power"]) if (w["average_power"] is not None and w["average_power"] > 0) else 150.0
            
            for t in range(duration_int):
                curr_ts = db_start + timedelta(seconds=t)
                curr_ts_rounded = curr_ts.replace(microsecond=0)
                
                match_r = None
                for offset_sec in [0, 1, -1, 2, -2, 3, -3]:
                    check_ts = curr_ts_rounded + timedelta(seconds=offset_sec)
                    if check_ts in suunto_by_ts:
                        match_r = suunto_by_ts[check_ts]
                        break
                        
                hr_val = match_r["heart_rate"] if match_r else None
                cad_val = match_r["cadence"] if match_r else None
                spd_val = match_r["speed"] if match_r else None
                alt_val = match_r["altitude"] if match_r else None
                
                if match_r and match_r["power"] is not None and match_r["power"] > 0:
                    p_val = match_r["power"]
                elif hr_val is not None:
                    # Estimate power dynamically from HR effort curve
                    p_val = ftp * (hr_val - resting_hr) / hr_range
                    p_val = max(10.0, float(p_val))
                else:
                    p_val = default_pwr
                
                updated_stream.append({
                    "time_offset": float(t),
                    "timestamp": curr_ts.isoformat(),
                    "heart_rate": hr_val,
                    "power": round(p_val, 1),
                    "cadence": cad_val,
                    "speed": spd_val,
                    "altitude": alt_val
                })
                
        # Forward/Backward fill missing HR values in stream
        last_hr = None
        for item in updated_stream:
            if item.get("heart_rate") is not None:
                last_hr = item["heart_rate"]
            elif last_hr is not None:
                item["heart_rate"] = last_hr
                
        first_hr = None
        for item in updated_stream:
            if item.get("heart_rate") is not None:
                first_hr = item["heart_rate"]
                break
        if first_hr is not None:
            for item in updated_stream:
                if item.get("heart_rate") is None:
                    item["heart_rate"] = first_hr
                else:
                    break
                    
        hrs_all = [item["heart_rate"] for item in updated_stream if item.get("heart_rate") is not None]
        
        if hrs_all:
            new_avg_hr = round(float(np.mean(hrs_all)), 1)
            new_max_hr = int(np.max(hrs_all))
        else:
            new_avg_hr = best_match["avg_hr"]
            new_max_hr = best_match["max_hr"]
            
        # Recalculate full sports science metrics for workout using updated stream
        calculated = calculate_metrics_for_workout(
            stream_data=updated_stream,
            ftp=user_params["ftp"],
            lthr=user_params["lthr"],
            resting_hr=user_params["resting_hr"],
            max_hr=user_params["max_hr"],
            cp=user_params["cp"],
            w_prime=user_params["w_prime"],
            weight_kg=user_params["weight_kg"]
        )
        
        # Prepare DB updates
        final_tss = calculated["tss"] if calculated["tss"] > 0 else (w["tss"] or 0.0)
        final_np = calculated["np"] or w["np"] or w["average_power"]
        final_if = calculated["if_factor"] or w["if_factor"]
        
        # Save updated/new stream into workout_streams table
        cursor.execute(
            "INSERT OR REPLACE INTO workout_streams (workout_id, stream_data) VALUES (?, ?)",
            (w_id, json.dumps(updated_stream))
        )
        
        # Save updated workout metadata
        cursor.execute("""
            UPDATE workouts SET
                average_hr = ?,
                max_hr = ?,
                hr_present = 1,
                tss = ?,
                np = ?,
                if_factor = ?,
                ef = ?,
                aerobic_decoupling = ?,
                w_prime_min = ?,
                matches_burned = ?,
                vi = ?,
                vo2max_est = ?,
                aerobic_work_kj = ?,
                anaerobic_work_kj = ?
            WHERE id = ?
        """, (
            new_avg_hr,
            new_max_hr,
            final_tss,
            final_np,
            final_if,
            calculated.get("ef"),
            calculated.get("aerobic_decoupling"),
            calculated.get("w_prime_min"),
            calculated.get("matches_burned"),
            calculated.get("vi"),
            calculated.get("vo2max_est"),
            calculated.get("aerobic_work_kj"),
            calculated.get("anaerobic_work_kj"),
            w_id
        ))
        
        merged_count += 1
        print(f"  [SUCCESS] '{w_title}' ({w_id}): HR {new_avg_hr}/{new_max_hr} bpm | NP: {final_np:.1f}W | TSS: {final_tss:.1f} | VI: {calculated.get('vi')} | EF: {calculated.get('ef')}")
        
    conn.commit()
    conn.close()
    
    print(f"\n==========================================")
    print(f"Merging complete! Updated {merged_count} workouts in local database ({created_streams_count} new streams generated).")
    print(f"==========================================\n")
    
    if merged_count > 0:
        print("Now running server synchronization...")
        try:
            sync_to_server()
        except Exception as e:
            print(f"Server sync error: {e}")

if __name__ == "__main__":
    main()
