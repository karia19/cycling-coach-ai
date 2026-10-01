You are an expert full-stack developer and sports science engineer specializing in cycling performance analytics and privacy-first applications.

Build a complete, production-ready local-first cycling performance tracking and AI coaching application with the following exact specifications:

### 1. Project Overview
Name: LocalCyclingCoach (or similar)
Purpose: A fully private cycling analytics + AI coaching platform. Users upload their own FIT/TCX/GPX files. All data stays on the user's machine or private server. No third-party cloud services for workout data.

Primary use case: Gravel racing preparation for age-group athletes.

### 2. Tech Stack (strict)
Frontend:
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Recharts or Tremor for beautiful charts
- Framer Motion for smooth animations
- Dark mode by default (cycling aesthetic)

Backend:
- Python 3.12+
- FastAPI
- SQLAlchemy 2.0 + Alembic
- Pydantic v2
- fitparse or garmin-fit-sdk for FIT file parsing
- pandas + numpy for calculations

Database:
- SQLite as default (fully local)
- Optional PostgreSQL for self-hosted multi-user mode

Authentication:
- Optional login (NextAuth.js or better-auth)
- Must also support complete single-user local mode without any login

**Port configuration (very important):**
- Do NOT use common default ports (3000, 8000, 8080, 5000, 5173, etc.) because they are already in use on the user's machine.
- Frontend (Next.js) should default to a high port such as 3456 or 4567
- Backend (FastAPI) should default to a high port such as 8765 or 9876
- Make ports easily configurable via environment variables (.env)
- Document clearly how to change ports

### 3. Core Features

A. Data Import & Robustness (critical)
- Drag & drop or file picker for .fit, .tcx, .gpx files
- Must handle incomplete data gracefully — the application must NEVER crash if power, heart rate, cadence, or other fields are missing
- Support for files that contain only heart rate (common with some Polar devices)
- Support for files that contain only power (common with smart trainers / Zwift)
- Ability to manually or semi-automatically merge / link data from different sources for the same workout session
  (Example: one file has heart rate from Polar, another file has power + cadence from Zwift/trainer → user can combine them into one complete workout)
- Smart matching of workouts by timestamp when possible
- Clear visual indication when power data is missing vs estimated vs real

B. Physiological & Equipment Parameters
User can set and edit:
- Current FTP
- Max HR / LTHR / Resting HR
- Body weight
- Bike weight (important for calculations and future power estimation)
- Wheel size / rolling resistance estimates (optional advanced)
- Age, gender (optional)
- Any other relevant parameters for better estimations when power is missing

C. Performance Metrics
Calculate (when data is available):
- Normalized Power (NP)
- Intensity Factor (IF)
- Training Stress Score (TSS) — power-based preferred, HR-based as fallback
- CTL, ATL, TSB
- When power is completely missing → use HR-based TSS and clearly mark it as estimated
- Never fail calculations just because power is absent

D. User Goals & Constraints
- Primary goal (e.g. “Gravel race 100 km on 2026-09-20”)
- Race distance, expected elevation gain, surface type
- Weekly available training hours / capacity (e.g. max 7–8 hours per week)
- Preferred training intensity distribution
- Limitations or injuries

E. AI Coaching Agent
- Knows the user’s goal, FTP, bike weight, body weight, weekly capacity, and recent training load
- Can analyze incomplete data without failing
- Gives concrete recommendations based on available data
- Warns about overtraining / undertraining / poor intensity distribution
- Supports tool calling (query workouts, calculate trends, etc.)
- Responds in the user’s language (Finnish or English)

F. Beautiful Dashboard
- CTL / ATL / TSB chart
- Weekly load
- Power & HR distribution (with clear “power missing” states)
- Goal progress indicators
- Individual workout analysis that works even with partial data
- Visual distinction between real power, estimated power, and HR-only workouts

### 4. Privacy & Security
- Fully local-first
- All data stays under user control
- Ability to wipe everything
- Optional database encryption

### 5. Settings
- Choose any LLM model (Ollama local preferred + any OpenAI-compatible endpoint)
- Set FTP, body weight, bike weight, HR zones, etc.
- Define goals and weekly training capacity
- Configure ports if needed
- Language (Finnish + English)

### 6. Implementation Rules
- Extremely robust error handling for missing sensor data
- Clean architecture
- Strong typing
- High ports by default
- Excellent documentation on how to run with custom ports and with Ollama

### 7. Deliverables order
1. Project structure + configuration (including high ports)
2. Database models (including support for partial data and data merging)
3. Robust FIT/TCX parser that never crashes on missing fields
4. Metrics engine with power + HR fallbacks
5. FastAPI backend
6. Next.js frontend with beautiful charts
7. AI agent with proper system prompt
8. Data merging UI for combining Polar + Zwift/trainer files

Always prioritize:
1. Never crashing on incomplete data
2. User privacy
3. Correct sports science calculations
4. Beautiful and clear visualization of data quality (real power vs estimated vs HR-only)