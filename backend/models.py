import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, ForeignKey
from backend.database import Base

class UserParameters(Base):
    __tablename__ = "user_parameters"
    
    id = Column(Integer, primary_key=True, index=True)
    ftp = Column(Float, default=200.0)
    cp = Column(Float, default=200.0)  # Critical Power (W)
    w_prime = Column(Float, default=20000.0)  # Anaerobic Work Capacity W' (Joules)
    max_hr = Column(Integer, default=190)
    lthr = Column(Integer, default=165)
    resting_hr = Column(Integer, default=50)
    weight_kg = Column(Float, default=75.0)
    bike_weight_kg = Column(Float, default=9.0)
    wheel_size_mm = Column(Float, default=2100.0)
    gender = Column(String, default="unspecified")
    age = Column(Integer, default=35)
    language = Column(String, default="fi")  # 'fi' or 'en'
    llm_provider = Column(String, default="ollama")
    llm_api_key = Column(String, default="")
    llm_model = Column(String, default="llama3.1")
    ollama_url = Column(String, default="http://localhost:11434")
    sync_mode = Column(String, default="local")  # 'local', 'remote_endpoint', 'strava'
    remote_server_url = Column(String, default="https://cycling-sync.oivauix.org")
    remote_api_key = Column(String, default="my_very_secure_secret_token_12345")
    strava_client_id = Column(String, default="")
    strava_client_secret = Column(String, default="")

class UserGoal(Base):
    __tablename__ = "user_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_description = Column(String, default="Gravel race 100 km")
    target_date = Column(String, nullable=True)  # "YYYY-MM-DD"
    race_distance_km = Column(Float, default=100.0)
    elevation_gain_m = Column(Float, default=1000.0)
    surface_type = Column(String, default="gravel")
    weekly_capacity_hours = Column(Float, default=8.0)
    intensity_distribution = Column(String, default="polarized")
    limitations = Column(String, nullable=True, default="")
    custom_prompt = Column(String, nullable=True, default="")

class RawFile(Base):
    __tablename__ = "raw_files"
    
    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # 'fit', 'tcx', 'gpx'
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    sensors_present = Column(JSON, nullable=True)  # ['power', 'hr', 'cadence', 'gps', 'elevation']
    filepath = Column(String, nullable=False)  # Path to file on disk
    status = Column(String, default="unmerged")  # 'unmerged', 'merged', 'error'
    source = Column(String, default="local")  # 'local', 'strava', 'suunto'

class Workout(Base):
    __tablename__ = "workouts"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    duration_seconds = Column(Float, nullable=False)
    distance_meters = Column(Float, nullable=False)
    
    average_power = Column(Float, nullable=True)
    max_power = Column(Float, nullable=True)
    average_hr = Column(Float, nullable=True)
    max_hr = Column(Integer, nullable=True)
    average_cadence = Column(Float, nullable=True)
    total_elevation_gain = Column(Float, nullable=True)
    calories = Column(Float, nullable=True)
    
    # Sports science metrics
    tss = Column(Float, nullable=True)
    tss_type = Column(String, nullable=True)  # 'power', 'hr', 'estimated'
    np = Column(Float, nullable=True)
    if_factor = Column(Float, nullable=True)
    peak_20min_power = Column(Float, nullable=True)
    
    # Advanced sports science metrics (Golden Cheetah)
    w_prime_min = Column(Float, nullable=True)  # Minimum W'bal remaining during workout (Joules)
    matches_burned = Column(Integer, nullable=True)  # Count of high-intensity surge efforts
    vi = Column(Float, nullable=True)  # Variability Index (NP / AvgPower)
    ef = Column(Float, nullable=True)  # Efficiency Factor (NP / AvgHR)
    aerobic_decoupling = Column(Float, nullable=True)  # Pw:HR Aerobic Decoupling %
    vo2max_est = Column(Float, nullable=True)  # Estimated VO2max ml/kg/min
    aerobic_work_kj = Column(Float, nullable=True)  # Work done below CP (kJ)
    anaerobic_work_kj = Column(Float, nullable=True)  # Work done above CP (kJ)
    
    # Flags and metadata
    is_merged = Column(Boolean, default=False)
    real_power_present = Column(Boolean, default=False)
    estimated_power_present = Column(Boolean, default=False)
    hr_present = Column(Boolean, default=False)
    source = Column(String, default="local")  # 'local', 'strava', 'suunto', 'manual', 'hybrid'
    strava_id = Column(String, nullable=True, index=True)
    source_file_ids = Column(JSON, nullable=False)  # List of raw file IDs

class WorkoutStream(Base):
    __tablename__ = "workout_streams"
    
    workout_id = Column(String, primary_key=True, index=True)
    # Stream is stored as a JSON array of dicts: 
    # [{"time_offset": 0, "power": 200, "heart_rate": 140, "cadence": 85, "speed": 8.5, "altitude": 102.5, "lat": 60.1, "lon": 24.9}, ...]
    stream_data = Column(JSON, nullable=False)
