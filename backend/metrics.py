import datetime
import math
import numpy as np
import pandas as pd

def calculate_normalized_power(power_series: list[float]) -> float:
    """
    Calculates Normalized Power (NP) from a list of power values (one sample per second).
    NP is calculated by:
      1. 30-second rolling average
      2. Values raised to the 4th power
      3. Average of those values
      4. 4th root of that average
    """
    if not power_series:
        return 0.0
        
    s = pd.Series(power_series)
    # Fill NaN with 0 (coasting)
    s = s.fillna(0.0)
    
    # 30-second rolling average
    r = s.rolling(window=30, min_periods=1).mean()
    
    # Raise to 4th power
    r4 = r ** 4
    
    # Average and 4th root
    mean_r4 = r4.mean()
    if pd.isna(mean_r4) or mean_r4 <= 0:
        return 0.0
        
    return float(mean_r4 ** 0.25)

def calculate_wprime_balance(power_series: list[float], cp: float, w_prime: float) -> dict:
    """
    Implements Dr. Phil Skiba's W'bal differential/exponential reconstitution model.
    Returns:
      {
        "w_prime_series": list[float],  # W'bal in Joules per second
        "w_prime_min": float,           # Minimum W'bal reached (Joules)
        "matches_burned": int           # Number of surge efforts depleting W'bal < 50%
      }
    """
    if not power_series or w_prime <= 0 or cp <= 0:
        return {"w_prime_series": [], "w_prime_min": w_prime, "matches_burned": 0}
        
    w_bal = w_prime
    w_series = []
    min_w = w_prime
    matches = 0
    in_match = False
    
    for p in power_series:
        p_val = p if (p is not None and not math.isnan(p)) else 0.0
        
        if p_val > cp:
            # Depletion
            w_bal -= (p_val - cp)
        else:
            # Reconstitution (Skiba exponential recovery)
            diff_cp = cp - p_val
            tau = 546.0 * math.exp(-0.01 * diff_cp) + 316.0
            w_bal += (w_prime - w_bal) * (1.0 - math.exp(-1.0 / tau))
            
        # Clamp bounds
        w_bal = max(0.0, min(w_prime, w_bal))
        w_series.append(float(w_bal))
        
        if w_bal < min_w:
            min_w = w_bal
            
        # Match counting: if W'bal drops to or below 50% of W' during a surge
        if w_bal <= (0.50 * w_prime) and not in_match:
            in_match = True
            matches += 1
        elif w_bal > (0.75 * w_prime) and in_match:
            in_match = False
            
    return {
        "w_prime_series": w_series,
        "w_prime_min": float(min_w),
        "matches_burned": matches
    }

def calculate_cp_and_wprime(power_duration_curve: dict[int, float], fallback_ftp: float = 200.0) -> tuple[float, float]:
    """
    Calculates CP (Critical Power in Watts) and W' (Anaerobic Work Capacity in Joules)
    from a power-duration curve using linear regression (Work = CP * t + W').
    Uses durations between 120s (2m) and 1800s (30m).
    """
    valid_points = []
    for d, p in power_duration_curve.items():
        if 120 <= d <= 1800 and p > 0:
            valid_points.append((d, p * d))
            
    if len(valid_points) < 2:
        cp_est = fallback_ftp if fallback_ftp > 0 else 200.0
        return cp_est, 20000.0
        
    t_vals = np.array([pt[0] for pt in valid_points])
    w_vals = np.array([pt[1] for pt in valid_points])
    
    try:
        slope, intercept = np.polyfit(t_vals, w_vals, 1)
        cp = float(slope)
        w_prime = float(intercept)
        
        if cp < 50.0 or cp > 800.0 or w_prime < 3000.0 or w_prime > 60000.0:
            return fallback_ftp if fallback_ftp > 0 else 200.0, 20000.0
            
        return round(cp, 1), round(w_prime, 0)
    except Exception:
        return fallback_ftp if fallback_ftp > 0 else 200.0, 20000.0

def calculate_metrics_for_workout(stream_data: list[dict], ftp: float, lthr: int, resting_hr: int = 50, max_hr: int = 190, cp: float = 200.0, w_prime: float = 20000.0, weight_kg: float = 75.0, gender: str = "unspecified") -> dict:
    """
    Calculates NP, IF, TSS, W'bal, VI, EF, Aerobic Decoupling, VO2max estimate, and energy splits.
    """
    if not stream_data:
        return {"tss": 0.0, "tss_type": "estimated"}
        
    df = pd.DataFrame(stream_data)
    
    # Sort and remove duplicate timestamps to prevent reindex ValueError
    if "time_offset" in df.columns:
        df = df.sort_values("time_offset").drop_duplicates(subset=["time_offset"])
        max_offset = int(df["time_offset"].max())
    else:
        max_offset = len(df) - 1
        df["time_offset"] = list(range(len(df)))
    
    # Reindex on a continuous 1-second grid to handle gaps
    df_grid = df.set_index("time_offset").reindex(range(max_offset + 1))
    
    # Fill power with 0 (not pedaling) and forward fill/interpolate HR and Cadence
    if "power" in df_grid.columns:
        df_grid["power"] = df_grid["power"].fillna(0.0)
    else:
        df_grid["power"] = np.nan
        
    if "heart_rate" in df_grid.columns:
        df_grid["heart_rate"] = df_grid["heart_rate"].ffill().bfill()
    else:
        df_grid["heart_rate"] = np.nan
        
    if "cadence" in df_grid.columns:
        df_grid["cadence"] = df_grid["cadence"].ffill().bfill()
    else:
        df_grid["cadence"] = np.nan

    duration_seconds = float(max_offset + 1)
    
    # Compute Averages safely
    power_list = df_grid["power"].dropna().tolist()
    hr_list = df_grid["heart_rate"].dropna().tolist()
    cad_list = df_grid["cadence"].dropna().tolist()
    
    avg_power = float(np.mean(power_list)) if power_list else None
    max_power = float(np.max(power_list)) if power_list else None
    avg_hr = float(np.mean(hr_list)) if hr_list else None
    max_hr_val = int(np.max(hr_list)) if hr_list else None
    avg_cad = float(np.mean(cad_list)) if cad_list else None
    
    np_val = None
    if_factor = None
    tss = 0.0
    tss_type = "estimated"
    
    # Check if power is present
    has_power = avg_power is not None and len([p for p in power_list if p > 0]) > 0
    
    if has_power:
        np_val = calculate_normalized_power(df_grid["power"].tolist())
        if ftp and ftp > 0:
            if_factor = np_val / ftp
            tss = (duration_seconds * np_val * if_factor) / (ftp * 3600.0) * 100.0
            tss_type = "power"
        else:
            has_power = False
            
    if not has_power:
        if avg_hr and lthr and lthr > 0:
            if_hr = avg_hr / lthr
            tss = (duration_seconds * avg_hr * if_hr) / (lthr * 3600.0) * 100.0
            tss_type = "hr"
            if_factor = if_hr
        elif avg_hr and resting_hr and max_hr:
            hr_ratio = (avg_hr - resting_hr) / (max_hr - resting_hr)
            hr_ratio = max(0.01, min(0.99, hr_ratio))
            # Gender-specific Banister TRIMP coefficients:
            # Male: 0.64 * exp(1.92 * hr_ratio) | Female: 0.86 * exp(1.67 * hr_ratio)
            if gender and gender.lower() == "female":
                trimp = (duration_seconds / 60.0) * hr_ratio * 0.86 * math.exp(1.67 * hr_ratio)
            else:
                trimp = (duration_seconds / 60.0) * hr_ratio * 0.64 * math.exp(1.92 * hr_ratio)
            tss = trimp
            tss_type = "hr"
            if_factor = hr_ratio
        else:
            tss = (duration_seconds / 3600.0) * 50.0
            tss_type = "estimated"
            if_factor = 0.5
            
    peak_20m = None
    peak_5m = None
    if has_power and len(df_grid["power"]) >= 1200:
        rolling_20m = df_grid["power"].rolling(window=1200).mean().max()
        if not pd.isna(rolling_20m):
            peak_20m = float(rolling_20m)
            
    if has_power and len(df_grid["power"]) >= 300:
        rolling_5m = df_grid["power"].rolling(window=300).mean().max()
        if not pd.isna(rolling_5m):
            peak_5m = float(rolling_5m)
            
    # Golden Cheetah advanced sports science metrics
    effective_cp = cp if (cp and cp > 0) else (ftp if (ftp and ftp > 0) else 200.0)
    effective_wprime = w_prime if (w_prime and w_prime > 0) else 20000.0
    
    w_prime_min = None
    matches_burned = 0
    vi = None
    ef = None
    aerobic_decoupling = None
    vo2max_est = None
    aerobic_work_kj = 0.0
    anaerobic_work_kj = 0.0
    
    if has_power:
        # 1. W'bal tracking
        w_bal_res = calculate_wprime_balance(power_list, effective_cp, effective_wprime)
        w_prime_min = w_bal_res["w_prime_min"]
        matches_burned = w_bal_res["matches_burned"]
        
        # 2. Variability Index (VI)
        if avg_power and avg_power > 0 and np_val:
            vi = float(np_val / avg_power)
            
        # 3. Efficiency Factor (EF)
        if np_val and avg_hr and avg_hr > 0:
            ef = float(np_val / avg_hr)
            
        # 4. Aerobic Decoupling (Pw:HR drift %)
        if len(power_list) >= 600 and avg_hr:
            half_len = len(power_list) // 2
            p1 = power_list[:half_len]
            p2 = power_list[half_len:]
            
            hr1 = hr_list[:half_len] if len(hr_list) >= len(power_list) else []
            hr2 = hr_list[half_len:] if len(hr_list) >= len(power_list) else []
            
            if hr1 and hr2 and np.mean(hr1) > 0 and np.mean(hr2) > 0:
                np1 = calculate_normalized_power(p1)
                np2 = calculate_normalized_power(p2)
                ef1 = np1 / float(np.mean(hr1))
                ef2 = np2 / float(np.mean(hr2))
                if ef1 > 0:
                    aerobic_decoupling = float(((ef1 - ef2) / ef1) * 100.0)
                    
        # 5. Estimated VO2max (ml/kg/min) from peak 5-min power
        if peak_5m and weight_kg and weight_kg > 0:
            vo2max_est = float((10.8 * peak_5m / weight_kg) + 7.0)
            
        # 6. Aerobic vs Anaerobic work split
        for p in power_list:
            if p <= effective_cp:
                aerobic_work_kj += (p / 1000.0)
            else:
                aerobic_work_kj += (effective_cp / 1000.0)
                anaerobic_work_kj += ((p - effective_cp) / 1000.0)
                
    return {
        "average_power": avg_power,
        "max_power": max_power,
        "average_hr": avg_hr,
        "max_hr": max_hr_val,
        "average_cadence": avg_cad,
        "duration_seconds": duration_seconds,
        "np": np_val,
        "if_factor": if_factor,
        "tss": float(tss),
        "tss_type": tss_type,
        "peak_20min_power": peak_20m,
        "w_prime_min": w_prime_min,
        "matches_burned": matches_burned,
        "vi": vi,
        "ef": ef,
        "aerobic_decoupling": aerobic_decoupling,
        "vo2max_est": vo2max_est,
        "aerobic_work_kj": float(aerobic_work_kj),
        "anaerobic_work_kj": float(anaerobic_work_kj)
    }

def calculate_ctl_atl_tsb(workouts: list[dict], target_date: datetime.date = None) -> list[dict]:
    """
    Calculates Chronic Training Load (CTL), Acute Training Load (ATL), and Training Stress Balance (TSB).
    workouts: list of dicts with {"date": datetime.date, "tss": float}
    Returns a chronological list of dicts for each day in the training history:
      [{"date": "YYYY-MM-DD", "ctl": float, "atl": float, "tsb": float, "tss": float}]
    """
    if not workouts:
        return []
        
    # Group TSS by calendar date
    df_w = pd.DataFrame(workouts)
    df_w["date"] = pd.to_datetime(df_w["date"]).dt.date
    daily_tss = df_w.groupby("date")["tss"].sum().to_dict()
    
    # Establish timeline up to the max actual workout date
    min_date = min(daily_tss.keys())
    max_date = max(daily_tss.keys())
    
    date_range = pd.date_range(start=min_date, end=max_date).date
    
    # Seed initial fitness/fatigue from early training load average if available
    first_few_values = [daily_tss[k] for k in sorted(daily_tss.keys())[:7] if daily_tss[k] > 0]
    initial_seed = float(np.mean(first_few_values)) if first_few_values else 0.0
    
    ctl_yesterday = initial_seed
    atl_yesterday = initial_seed
    
    history = []
    
    for d in date_range:
        tss_today = daily_tss.get(d, 0.0)
        
        # CTL: 42-day time constant
        # CTL_today = CTL_yesterday + (TSS_today - CTL_yesterday) / 42
        ctl_today = ctl_yesterday + (tss_today - ctl_yesterday) / 42.0
        
        # ATL: 7-day time constant
        # ATL_today = ATL_yesterday + (TSS_today - ATL_yesterday) / 7
        atl_today = atl_yesterday + (tss_today - atl_yesterday) / 7.0
        
        # TSB: CTL_yesterday - ATL_yesterday
        tsb_today = ctl_yesterday - atl_yesterday
        
        history.append({
            "date": d.isoformat(),
            "tss": tss_today,
            "ctl": float(ctl_today),
            "atl": float(atl_today),
            "tsb": float(tsb_today)
        })
        
        ctl_yesterday = ctl_today
        atl_yesterday = atl_today
        
    return history

def calculate_power_duration_curve_for_stream(stream_data: list[dict]) -> dict[int, float]:
    """Calculates peak powers for standard durations from a workout stream."""
    if not stream_data:
        return {}
        
    df = pd.DataFrame(stream_data)
    if "power" not in df.columns:
        return {}
        
    # Drop rows where power is null
    df_power = df.dropna(subset=["power"])
    if df_power.empty:
        return {}
        
    # Sort and reindex to 1s grid
    df_power = df_power.sort_values("time_offset")
    max_offset = int(df_power["time_offset"].max()) if "time_offset" in df_power.columns else len(df_power) - 1
    s_pwr = df_power.set_index("time_offset").reindex(range(max_offset + 1))["power"].fillna(0.0)
    
    durations = [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600]
    curve = {}
    
    for d in durations:
        if len(s_pwr) >= d:
            rolling_max = s_pwr.rolling(window=d).mean().max()
            curve[d] = float(rolling_max) if not pd.isna(rolling_max) else 0.0
        else:
            curve[d] = 0.0
            
    return curve
