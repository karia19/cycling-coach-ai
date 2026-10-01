import os
import datetime
import xml.etree.ElementTree as ET
import pandas as pd
import numpy as np
import fitparse
import gpxpy

def parse_iso_datetime(dt_str):
    if not dt_str:
        return None
    # Strip timezone offset if present for simplicity
    dt_str = dt_str.split(".")[0].replace("Z", "")
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%SZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.datetime.strptime(dt_str[:19], fmt)
        except ValueError:
            pass
    return None

def find_watts_in_extensions(extensions_node):
    """Recursively search XML node for power/watts."""
    if extensions_node is None:
        return None
    for child in extensions_node:
        tag = child.tag.lower()
        if "watts" in tag or "power" in tag:
            try:
                return float(child.text)
            except (ValueError, TypeError):
                pass
        # Recursive search
        res = find_watts_in_extensions(child)
        if res is not None:
            return res
    return None

def find_hr_cad_in_extensions(extensions_node):
    """Recursively search XML node for heart rate and cadence in GPX extensions."""
    hr = None
    cad = None
    if extensions_node is None:
        return hr, cad
    
    for child in extensions_node:
        tag = child.tag.lower()
        if "hr" in tag or "heartrate" in tag:
            try:
                hr = int(float(child.text))
            except (ValueError, TypeError):
                pass
        elif "cad" in tag or "cadence" in tag:
            try:
                cad = int(float(child.text))
            except (ValueError, TypeError):
                pass
        
        # Recursive check
        sub_hr, sub_cad = find_hr_cad_in_extensions(child)
        if sub_hr is not None and hr is None:
            hr = sub_hr
        if sub_cad is not None and cad is None:
            cad = sub_cad
            
    return hr, cad

def parse_fit_file(filepath):
    """Parses FIT file using fitparse and returns meta and stream."""
    try:
        fitfile = fitparse.FitFile(filepath)
    except Exception as e:
        raise ValueError(f"Failed to parse FIT file: {str(e)}")
        
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
            
        # Convert semicircles to degrees
        lat = values.get("position_lat")
        lon = values.get("position_long")
        if lat is not None:
            lat = lat * (180.0 / 2147483648.0)
        if lon is not None:
            lon = lon * (180.0 / 2147483648.0)
            
        # Extract fields, default to None if missing
        pwr = values.get("power")
        hr = values.get("heart_rate")
        cad = values.get("cadence")
        spd = values.get("speed")  # in m/s
        alt = values.get("altitude")  # in meters
        dist = values.get("distance")  # in meters
        
        records.append({
            "timestamp": ts,
            "power": float(pwr) if pwr is not None else None,
            "heart_rate": int(hr) if hr is not None else None,
            "cadence": int(cad) if cad is not None else None,
            "speed": float(spd) if spd is not None else None,
            "altitude": float(alt) if alt is not None else None,
            "distance": float(dist) if dist is not None else None,
            "lat": lat,
            "lon": lon
        })
        
    if not records:
        raise ValueError("FIT file contains no records.")
        
    return build_standard_output(records, start_time, end_time)

def parse_tcx_file(filepath):
    """Parses TCX (XML) file."""
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
    except Exception as e:
        raise ValueError(f"Failed to parse TCX XML: {str(e)}")
        
    # TCX tags namespace handling
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"
        
    records = []
    start_time = None
    end_time = None
    
    # TCX structure: Activities/Activity/Lap/Track/Trackpoint
    for tp in root.findall(f".//{ns}Trackpoint"):
        time_node = tp.find(f"{ns}Time")
        if time_node is None or not time_node.text:
            continue
            
        ts = parse_iso_datetime(time_node.text)
        if not ts:
            continue
            
        if start_time is None or ts < start_time:
            start_time = ts
        if end_time is None or ts > end_time:
            end_time = ts
            
        # Latitude / Longitude
        lat = None
        lon = None
        pos = tp.find(f"{ns}Position")
        if pos is not None:
            lat_deg = pos.find(f"{ns}LatitudeDegrees")
            lon_deg = pos.find(f"{ns}LongitudeDegrees")
            if lat_deg is not None and lat_deg.text:
                lat = float(lat_deg.text)
            if lon_deg is not None and lon_deg.text:
                lon = float(lon_deg.text)
                
        # Altitude
        alt = None
        alt_node = tp.find(f"{ns}AltitudeMeters")
        if alt_node is not None and alt_node.text:
            alt = float(alt_node.text)
            
        # Distance
        dist = None
        dist_node = tp.find(f"{ns}DistanceMeters")
        if dist_node is not None and dist_node.text:
            dist = float(dist_node.text)
            
        # Heart Rate
        hr = None
        hr_node = tp.find(f"{ns}HeartRateBpm/{ns}Value")
        if hr_node is not None and hr_node.text:
            hr = int(float(hr_node.text))
            
        # Cadence
        cad = None
        cad_node = tp.find(f"{ns}Cadence")
        if cad_node is not None and cad_node.text:
            cad = int(float(cad_node.text))
            
        # Power (usually in extensions)
        pwr = None
        ext = tp.find(f"{ns}Extensions")
        if ext is not None:
            pwr = find_watts_in_extensions(ext)
            
        records.append({
            "timestamp": ts,
            "power": pwr,
            "heart_rate": hr,
            "cadence": cad,
            "speed": None,  # Speed is rarely in TCX directly, can be calculated
            "altitude": alt,
            "distance": dist,
            "lat": lat,
            "lon": lon
        })
        
    if not records:
        raise ValueError("TCX file contains no Trackpoints.")
        
    return build_standard_output(records, start_time, end_time)

def parse_gpx_file(filepath):
    """Parses GPX file using gpxpy and custom XML extension parsing."""
    try:
        with open(filepath, "r", errors="ignore") as f:
            gpx = gpxpy.parse(f)
    except Exception as e:
        raise ValueError(f"Failed to parse GPX: {str(e)}")
        
    records = []
    start_time = None
    end_time = None
    
    for track in gpx.tracks:
        for segment in track.segments:
            for pt in segment.points:
                ts = pt.time
                if not ts:
                    continue
                # Make timezone naive
                ts = ts.replace(tzinfo=None)
                
                if start_time is None or ts < start_time:
                    start_time = ts
                if end_time is None or ts > end_time:
                    end_time = ts
                    
                # Search extensions for HR and Cadence
                hr = None
                cad = None
                pwr = None
                for ext in pt.extensions:
                    # Parse extension XML nodes
                    h, c = find_hr_cad_in_extensions(ext)
                    if h is not None:
                        hr = h
                    if c is not None:
                        cad = c
                    w = find_watts_in_extensions(ext)
                    if w is not None:
                        pwr = w
                        
                records.append({
                    "timestamp": ts,
                    "power": pwr,
                    "heart_rate": hr,
                    "cadence": cad,
                    "speed": getattr(pt, 'speed', None),
                    "altitude": pt.elevation,
                    "distance": None, # gpxpy can compute distance if needed
                    "lat": pt.latitude,
                    "lon": pt.longitude
                })
                
    if not records:
        raise ValueError("GPX file contains no points.")
        
    # Compute distances and speeds if missing
    # Let's populate distance using gpxpy's distance calculations
    curr_dist = 0.0
    for i in range(len(records)):
        if i == 0:
            records[i]["distance"] = 0.0
        else:
            prev = records[i-1]
            curr = records[i]
            # Simple Haversine distance
            d = haversine_distance(prev["lat"], prev["lon"], curr["lat"], curr["lon"])
            curr_dist += d
            curr["distance"] = curr_dist
            
            # Estimate speed if missing
            if curr["speed"] is None:
                dt = (curr["timestamp"] - prev["timestamp"]).total_seconds()
                if dt > 0:
                    curr["speed"] = d / dt
                else:
                    curr["speed"] = 0.0
                    
    return build_standard_output(records, start_time, end_time)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates distance between two lat/lon coordinates in meters."""
    if None in (lat1, lon1, lat2, lon2):
        return 0.0
    import math
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def build_standard_output(records, start_time, end_time):
    """Sorts and formats records, computes metadata."""
    # Sort records by timestamp
    records = sorted(records, key=lambda x: x["timestamp"])
    
    # Calculate duration
    duration = 0
    if start_time and end_time:
        duration = (end_time - start_time).total_seconds()
        
    # Check present sensors
    sensors = set()
    powers = [r["power"] for r in records if r["power"] is not None]
    hrs = [r["heart_rate"] for r in records if r["heart_rate"] is not None]
    cads = [r["cadence"] for r in records if r["cadence"] is not None]
    lats = [r["lat"] for r in records if r["lat"] is not None]
    alts = [r["altitude"] for r in records if r["altitude"] is not None]
    
    if powers:
        sensors.add("power")
    if hrs:
        sensors.add("hr")
    if cads:
        sensors.add("cadence")
    if lats:
        sensors.add("gps")
    if alts:
        sensors.add("elevation")
        
    # Summary values
    max_dist = 0.0
    valid_dists = [r["distance"] for r in records if r["distance"] is not None]
    if valid_dists:
        max_dist = max(valid_dists)
        
    # Fill in time offsets in seconds and convert datetime objects to ISO strings for JSON serialization
    for r in records:
        r["time_offset"] = (r["timestamp"] - start_time).total_seconds()
        if isinstance(r["timestamp"], datetime.datetime):
            r["timestamp"] = r["timestamp"].isoformat()
        
    # Calculate elevation gain
    elevation_gain = 0.0
    if len(alts) > 1:
        # Simple threshold-based elevation gain to filter noise
        for i in range(1, len(records)):
            a1 = records[i-1]["altitude"]
            a2 = records[i]["altitude"]
            if a1 is not None and a2 is not None:
                diff = a2 - a1
                if diff > 0.3:  # 30 cm minimum threshold
                    elevation_gain += diff
                    
    meta = {
        "start_time": start_time,
        "end_time": end_time,
        "duration_seconds": duration,
        "distance_meters": max_dist,
        "average_power": float(np.mean(powers)) if powers else None,
        "max_power": float(np.max(powers)) if powers else None,
        "average_hr": float(np.mean(hrs)) if hrs else None,
        "max_hr": int(np.max(hrs)) if hrs else None,
        "average_cadence": float(np.mean(cads)) if cads else None,
        "total_elevation_gain": elevation_gain if "elevation" in sensors else 0.0,
        "calories": None,  # optional
        "sensors_present": list(sensors)
    }
    
    return {
        "meta": meta,
        "stream": records
    }

def parse_file(filepath):
    """Main entrypoint for parsing any supported workout file."""
    filename = os.path.basename(filepath).lower()
    ext = os.path.splitext(filepath)[1].lower().replace(".", "").strip()
    if "fit" in filename or ext == "fit" or filename.endswith(".fit"):
        return parse_fit_file(filepath)
    elif "tcx" in filename or ext == "tcx" or filename.endswith(".tcx"):
        return parse_tcx_file(filepath)
    elif "gpx" in filename or ext == "gpx" or filename.endswith(".gpx"):
        return parse_gpx_file(filepath)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

