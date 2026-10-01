#!/usr/bin/env python3
import os
import sys
import json
import sqlite3
from datetime import datetime, timedelta
import urllib.request
import urllib.error
import ssl

# --- CONFIGURATION ---
# Target Server Details
SERVER_URL = "https://cycling-sync.oivauix.org"
API_KEY = "my_very_secure_secret_token_12345"
VERIFY_SSL = False  # Set to False if your home server uses self-signed or unrecognized SSL certificates

# Local Paths (Absolute or relative to workspace)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "backend", "data", "trainer.db")
SYNC_TRACKER_PATH = os.path.join(BASE_DIR, "backend", "data", "synced_workouts.json")
# ---------------------

def get_ftp_from_db():
    """Fetches FTP from user_parameters table or defaults to 200."""
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}. Using default FTP 200.")
        return 200.0
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT ftp FROM user_parameters LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        if row and row[0] is not None:
            return float(row[0])
    except Exception as e:
        print(f"Error fetching FTP: {e}. Defaulting to 200.")
    return 200.0

def load_synced_workouts():
    """Loads already synchronized workout IDs from the local JSON tracker."""
    if os.path.exists(SYNC_TRACKER_PATH):
        try:
            with open(SYNC_TRACKER_PATH, "r") as f:
                return set(json.load(f))
        except Exception as e:
            print(f"Warning: Failed to read sync tracker file: {e}")
    return set()

def save_synced_workouts(synced_ids):
    """Saves synchronized workout IDs to the local JSON tracker."""
    try:
        os.makedirs(os.path.dirname(SYNC_TRACKER_PATH), exist_ok=True)
        with open(SYNC_TRACKER_PATH, "w") as f:
            json.dump(list(synced_ids), f, indent=2)
    except Exception as e:
        print(f"Error saving sync tracker file: {e}")

def parse_datetime(dt_str):
    """Parses database datetime string safely."""
    if not dt_str:
        return datetime.utcnow()
    dt_str = dt_str.replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d"):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return datetime.utcnow()

def get_peak_power(power_values, duration_seconds):
    """Calculates peak average power for a given duration (sliding window)."""
    if not power_values:
        return 0
    if len(power_values) <= duration_seconds:
        return int(sum(power_values) / len(power_values))
    
    current_sum = sum(power_values[:duration_seconds])
    max_sum = current_sum
    for i in range(duration_seconds, len(power_values)):
        current_sum = current_sum - power_values[i - duration_seconds] + power_values[i]
        if current_sum > max_sum:
            max_sum = current_sum
    return int(round(max_sum / duration_seconds))

def calculate_zone_time(power_values, ftp):
    """Calculates time spent in each of Coggan's 7 power zones."""
    zone_time = {str(i): 0 for i in range(1, 8)}
    if ftp <= 0:
        zone_time["1"] = len(power_values)
        return zone_time
        
    for p in power_values:
        pct = (p / ftp) * 100
        if pct < 55:
            zone_time["1"] += 1
        elif pct < 75:
            zone_time["2"] += 1
        elif pct < 90:
            zone_time["3"] += 1
        elif pct < 105:
            zone_time["4"] += 1
        elif pct < 120:
            zone_time["5"] += 1
        elif pct < 150:
            zone_time["6"] += 1
        else:
            zone_time["7"] += 1
    return zone_time

def send_to_server(payload):
    """Sends the workout payload to the home server using urllib."""
    url = f"{SERVER_URL.rstrip('/')}/api/sync/workout"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    context = None
    if not VERIFY_SSL:
        context = ssl._create_unverified_context()
        
    try:
        with urllib.request.urlopen(req, context=context) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        raise Exception(f"HTTP Error {e.code}: {e.reason} - {error_body}")
    except Exception as e:
        raise Exception(f"Connection Error: {e}")

def sync():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}.")
        sys.exit(1)
        
    ftp = get_ftp_from_db()
    print(f"Loaded FTP from database: {ftp} W")
    
    synced_ids = load_synced_workouts()
    print(f"Loaded {len(synced_ids)} already synchronized workouts.")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Query all workouts
    cursor.execute("SELECT * FROM workouts")
    workouts = cursor.fetchall()
    
    to_sync = [w for w in workouts if w["id"] not in synced_ids]
    
    if not to_sync:
        print("All workouts are already synchronized!")
        conn.close()
        return
        
    print(f"Found {len(to_sync)} new workouts to synchronize.")
    
    success_count = 0
    for w in to_sync:
        w_id = w["id"]
        w_title = w["title"]
        w_timestamp_str = w["timestamp"]
        
        print(f"\nProcessing '{w_title}' ({w_timestamp_str})...")
        
        # Fetch stream
        cursor.execute("SELECT stream_data FROM workout_streams WHERE workout_id = ?", (w_id,))
        stream_row = cursor.fetchone()
        
        if not stream_row or not stream_row["stream_data"]:
            print(f"  Warning: No stream data found for workout {w_id}. Skipping.")
            continue
            
        try:
            stream_data = json.loads(stream_row["stream_data"])
        except Exception as e:
            print(f"  Error: Failed to parse stream data: {e}. Skipping.")
            continue
            
        # Parse stream telemetry
        power_values = []
        speed_values = [] # m/s
        cadence_values = []
        hr_values = []
        
        datapoints = []
        for idx, item in enumerate(stream_data):
            p = int(item.get("power") or 0)
            # Speed from stream is in m/s, target requires km/h
            speed_ms = float(item.get("speed") or 0.0)
            speed_kmh = round(speed_ms * 3.6, 2)
            cad = int(item.get("cadence") or 0)
            hr = item.get("heart_rate")
            if hr is not None:
                hr = int(hr)
                
            lat = item.get("lat")
            if lat is not None:
                lat = float(lat)
            lon = item.get("lon")
            if lon is not None:
                lon = float(lon)
            ele = item.get("altitude")
            if ele is not None:
                ele = float(ele)
                
            power_values.append(p)
            speed_values.append(speed_kmh)
            cadence_values.append(cad)
            if hr is not None:
                hr_values.append(hr)
                
            datapoints.append({
                "elapsed_seconds": int(item.get("time_offset", idx)),
                "power_watts": p,
                "speed_kmh": speed_kmh,
                "cadence_rpm": cad,
                "heart_rate_bpm": hr,
                "latitude": lat,
                "longitude": lon,
                "elevation": ele
            })
            
        # Metrics Calculations
        duration = float(w["duration_seconds"])
        avg_power = float(w["average_power"]) if w["average_power"] is not None else 0.0
        
        # Calculate Peak Powers
        max_1s = get_peak_power(power_values, 1)
        max_5s = get_peak_power(power_values, 5)
        max_1m = get_peak_power(power_values, 60)
        max_5m = get_peak_power(power_values, 300)
        max_20m = get_peak_power(power_values, 1200)
        
        # Power Zones
        zone_time = calculate_zone_time(power_values, ftp)
        
        # Timestamps
        started_dt = parse_datetime(w_timestamp_str)
        ended_dt = started_dt + timedelta(seconds=duration)
        
        # Normalized Power & TSS fallback matching useWebSocket.ts
        np = float(w["np"]) if w["np"] is not None else avg_power
        intensity_factor = float(w["if_factor"]) if w["if_factor"] is not None else (np / ftp if ftp > 0 else 0.0)
        tss = float(w["tss"]) if w["tss"] is not None else (duration * np * intensity_factor) / (ftp * 36)
        total_kj = (avg_power * duration) / 1000.0
        
        payload = {
            "workout_plan_id": None,
            "plan_name": w_title,
            "started_at": started_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "ended_at": ended_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "total_distance_km": round((w["distance_meters"] or 0.0) / 1000.0, 3),
            "avg_power_watts": round(avg_power, 1),
            "normalized_power": round(np, 1),
            "tss": round(tss, 1),
            "intensity_factor": round(intensity_factor, 3),
            "total_kj": round(total_kj, 1),
            "max_power_1s": max_1s,
            "max_power_5s": max_5s,
            "max_power_1min": max_1m,
            "max_power_5min": max_5m,
            "max_power_20min": max_20m,
            "zone_time": zone_time,
            "datapoints": datapoints
        }
        
        try:
            res = send_to_server(payload)
            print(f"  Success: {res.get('message', 'Synced')}")
            synced_ids.add(w_id)
            save_synced_workouts(synced_ids)
            success_count += 1
        except Exception as e:
            print(f"  Failed: {e}")
            
    conn.close()
    print(f"\nSync complete. Successfully synced {success_count}/{len(to_sync)} new workouts.")

if __name__ == "__main__":
    sync()
