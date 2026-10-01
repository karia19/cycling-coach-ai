#!/usr/bin/env python3
import urllib.request
import json
import ssl

SERVER_URL = "https://cycling-sync.oivauix.org"
API_KEY = "my_very_secure_secret_token_12345"

def query_server():
    url = f"{SERVER_URL.rstrip('/')}/api/workouts"
    headers = {
        "X-API-Key": API_KEY,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    req = urllib.request.Request(url, headers=headers)
    context = ssl._create_unverified_context()
    
    try:
        print(f"Yhdistetään palvelimeen {url}...")
        with urllib.request.urlopen(req, context=context) as res:
            data = json.loads(res.read().decode("utf-8"))
            print(f"\nONNISTUI: Palvelimella on yhteensä {len(data)} harjoitusta.")
            
            print("\n10 viimeisintä synkronoitua harjoitusta palvelimella:")
            for w in data[:10]:
                print(f"- {w.get('plan_name')} ({w.get('started_at')}):")
                print(f"  Matka: {w.get('total_distance_km')} km | Keskiteho: {w.get('avg_power_watts')} W | NP: {w.get('normalized_power')} W")
    except Exception as e:
        print(f"Virhe kyselyssä: {e}")

if __name__ == "__main__":
    query_server()
