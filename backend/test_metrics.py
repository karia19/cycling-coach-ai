import unittest
import datetime
import numpy as np
from backend.metrics import (
    calculate_normalized_power,
    calculate_metrics_for_workout,
    calculate_ctl_atl_tsb,
    calculate_wprime_balance,
    calculate_cp_and_wprime
)

class TestSportsScienceMetrics(unittest.TestCase):
    
    def test_normalized_power(self):
        # A flat stream of 200W should have NP of 200W
        power_stream = [200.0] * 120  # 2 minutes of 200W
        np_val = calculate_normalized_power(power_stream)
        self.assertAlmostEqual(np_val, 200.0, places=1)
        
        # Test empty input
        self.assertEqual(calculate_normalized_power([]), 0.0)
        
    def test_metrics_for_workout_power(self):
        # Create 1 hour (3600s) workout at a flat 200W
        # User FTP is 200W, LTHR 165
        stream = []
        for i in range(3600):
            stream.append({
                "time_offset": i,
                "power": 200.0,
                "heart_rate": 150
            })
            
        calc = calculate_metrics_for_workout(stream, ftp=200.0, lthr=165)
        
        self.assertAlmostEqual(calc["average_power"], 200.0)
        self.assertAlmostEqual(calc["np"], 200.0)
        self.assertAlmostEqual(calc["if_factor"], 1.0)
        # 1 hour at FTP should be exactly 100 TSS
        self.assertAlmostEqual(calc["tss"], 100.0, places=1)
        self.assertEqual(calc["tss_type"], "power")

    def test_metrics_for_workout_hr_fallback(self):
        # 1 hour workout, no power data, average HR 165 (equal to LTHR)
        # This should give approximately 100 TSS based on hrTSS formula:
        # hrTSS = duration_seconds * (avg_hr / LTHR)^2 * 100 / 3600 = 3600 * (165/165)^2 * 100 / 3600 = 100
        stream = []
        for i in range(3600):
            stream.append({
                "time_offset": i,
                "heart_rate": 165
            })
            
        calc = calculate_metrics_for_workout(stream, ftp=200.0, lthr=165)
        
        self.assertIsNone(calc["average_power"])
        self.assertAlmostEqual(calc["average_hr"], 165.0)
        self.assertAlmostEqual(calc["tss"], 100.0, places=1)
        self.assertEqual(calc["tss_type"], "hr")
        
    def test_ctl_atl_tsb_calculation(self):
        # Test basic ctl/atl/tsb calculations with 3 workouts
        # Day 1: 100 TSS
        # Day 2: 100 TSS
        # Day 3: 0 TSS
        workouts = [
            {"date": datetime.date(2026, 8, 1), "tss": 100.0},
            {"date": datetime.date(2026, 8, 2), "tss": 100.0}
        ]
        
        history = calculate_ctl_atl_tsb(workouts)
        
        # Timeline should start at 2026-08-01 and end at max of today/max date
        self.assertTrue(len(history) >= 2)
        
        # Check Day 1 metrics
        # CTL: 0 + (100 - 0)/42 = 2.38
        # ATL: 0 + (100 - 0)/7 = 14.29 (14.2857...)
        # TSB: 0
        self.assertAlmostEqual(history[0]["ctl"], 2.38, places=2)
        self.assertAlmostEqual(history[0]["atl"], 14.29, places=2)
        self.assertAlmostEqual(history[0]["tsb"], 0.0, places=2)
        
        # Check Day 2 metrics
        # CTL: 2.38 + (100 - 2.38)/42 = 4.71
        # ATL: 14.29 + (100 - 14.29)/7 = 26.53
        # TSB: CTL_yesterday - ATL_yesterday = 2.38 - 14.29 = -11.90
        self.assertAlmostEqual(history[1]["ctl"], 4.71, places=2)
        self.assertAlmostEqual(history[1]["atl"], 26.53, places=2)
        self.assertAlmostEqual(history[1]["tsb"], -11.90, places=2)

    def test_skiba_w_prime(self):
        from backend.main import calculate_skiba_w_prime
        power_stream = [300.0] * 10
        w_bal = calculate_skiba_w_prime(power_stream, ftp=200.0, w_0=20000.0)
        self.assertEqual(len(w_bal), 10)
        self.assertAlmostEqual(w_bal[-1], 19.0, places=1)

    def test_wprime_balance_metrics(self):
        # 300W for 100s when CP is 200W should deplete 100s * 100W = 10,000J from 20,000J
        power_stream = [300.0] * 100
        res = calculate_wprime_balance(power_stream, cp=200.0, w_prime=20000.0)
        self.assertAlmostEqual(res["w_prime_min"], 10000.0, places=0)
        self.assertEqual(res["matches_burned"], 1)

    def test_cp_and_wprime_estimation(self):
        # Work(t) = CP * t + W'
        # Suppose CP = 250W, W' = 15000J
        # At t=180s (3m): Work = 250*180 + 15000 = 60000J -> Power = 333.33W
        # At t=600s (10m): Work = 250*600 + 15000 = 165000J -> Power = 275W
        pd_curve = {
            180: 333.33,
            300: 300.00,
            600: 275.00,
            1200: 262.50
        }
        cp, w_prime = calculate_cp_and_wprime(pd_curve, fallback_ftp=200.0)
        self.assertAlmostEqual(cp, 250.0, places=0)
        self.assertAlmostEqual(w_prime, 15000.0, delta=100.0)
        
    def test_aerobic_decoupling(self):
        from backend.main import calculate_aerobic_decoupling
        # Decoupling compares first half EF to second half EF.
        # First half: power 200W, HR 150BPM -> EF = 1.33
        # Second half: power 200W, HR 160BPM -> EF = 1.25
        # Drift = (1.333 - 1.25) / 1.333 * 100 = 6.25%
        power = [200.0] * 100
        hr = [150.0] * 50 + [160.0] * 50
        res = calculate_aerobic_decoupling(power, hr)
        self.assertAlmostEqual(res["decoupling_percent"], 6.25, places=2)

    def test_power_estimation(self):
        from backend.main import estimate_stream_power
        from backend.models import UserParameters
        
        # Test 1: HR-based estimation
        # FTP = 200W, LTHR = 165, resting HR = 50.
        # HR of 165 (equal to LTHR) should produce power equal to FTP (200W).
        params = UserParameters(ftp=200.0, lthr=165, resting_hr=50, max_hr=190, weight_kg=75.0, bike_weight_kg=9.0)
        stream = [{"heart_rate": 165}]
        estimated = estimate_stream_power(stream, params)
        self.assertAlmostEqual(estimated[0]["power"], 200.0)
        
        # Test 2: Physics aero-rolling speed-based fallback (no HR)
        # speed = 8.0 m/s (~28.8 km/h)
        # weight total = 75.0 + 9.0 = 84.0 kg.
        # P_rolling = 0.005 * 84.0 * 9.81 * 8.0 = 32.96 W
        # P_aero = 0.5 * 0.32 * 1.2 * (8.0**3) = 0.5 * 0.384 * 512 = 98.30 W
        # Total P_est = 32.96 + 98.30 = 131.26 W
        stream_no_hr = [{"speed": 8.0}]
        estimated_no_hr = estimate_stream_power(stream_no_hr, params)
        self.assertAlmostEqual(estimated_no_hr[0]["power"], 131.26, places=1)

if __name__ == "__main__":
    unittest.main()
