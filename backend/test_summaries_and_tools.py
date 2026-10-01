import os
import sys

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.summarizer import update_all_summaries, SUMMARIES_DIR
from backend.agent_tools import execute_agent_tool, AGENT_TOOLS_SCHEMA
from backend.coach import load_md_summaries

def test_summaries_and_tools():
    db = SessionLocal()
    try:
        print("--- 1. Testing update_all_summaries() ---")
        res = update_all_summaries(db)
        print("Summaries updated:", res)
        
        expected_files = ["coaching_directives.md", "athlete_profile.md", "weekly_history.md", "latest_workout.md"]
        for filename in expected_files:
            path = os.path.join(SUMMARIES_DIR, filename)
            assert os.path.exists(path), f"Missing summary file: {filename}"
            size = os.path.getsize(path)
            print(f"✓ {filename} exists ({size} bytes)")
            
        print("\n--- 2. Testing load_md_summaries() ---")
        summaries = load_md_summaries(db)
        assert len(summaries) == 4, f"Expected 4 MD summaries, got {len(summaries)}"
        assert "coaching_directives.md" in summaries
        print("✓ All 4 MD summaries loaded successfully including coaching_directives.md.")

        print("\n--- 3. Testing Agent Tools ---")
        search_res = execute_agent_tool("search_workout_history", {"keyword": "", "limit": 3}, db)
        print("Tool result (search_workout_history):\n", search_res)

        bests_res = execute_agent_tool("get_power_curve_bests", {"days": 90}, db)
        print("Tool result (get_power_curve_bests):\n", bests_res)

        print("\n--- 4. Checking AGENT_TOOLS_SCHEMA ---")
        print(f"✓ {len(AGENT_TOOLS_SCHEMA)} tool schemas registered for LLM tool calling.")

        print("\nALL TESTS PASSED SUCCESSFULLY! 🎉")
    finally:
        db.close()

if __name__ == "__main__":
    test_summaries_and_tools()
