from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class UserParametersBase(BaseModel):
    ftp: float = 200.0
    cp: float = 200.0
    w_prime: float = 20000.0
    max_hr: int = 190
    lthr: int = 165
    resting_hr: int = 50
    weight_kg: float = 75.0
    bike_weight_kg: float = 9.0
    wheel_size_mm: float = 2100.0
    gender: str = "unspecified"
    age: int = 35
    language: str = "fi"
    llm_provider: str = "ollama"
    llm_api_key: str = ""
    llm_model: str = "llama3.1"
    ollama_url: str = "http://localhost:11434"
    sync_mode: str = "local"
    remote_server_url: str = "https://cycling-sync.oivauix.org"
    remote_api_key: str = "my_very_secure_secret_token_12345"
    strava_client_id: str = ""
    strava_client_secret: str = ""

class UserParametersResponse(UserParametersBase):
    id: int

    class Config:
        from_attributes = True

class UserGoalBase(BaseModel):
    goal_description: str = "Gravel race 100 km"
    target_date: Optional[str] = None
    race_distance_km: float = 100.0
    elevation_gain_m: float = 1000.0
    surface_type: str = "gravel"
    weekly_capacity_hours: float = 8.0
    intensity_distribution: str = "polarized"
    limitations: Optional[str] = ""
    custom_prompt: Optional[str] = ""

class UserGoalResponse(UserGoalBase):
    id: int

    class Config:
        from_attributes = True

class RawFileResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    upload_time: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    sensors_present: Optional[list[str]] = []
    status: str
    source: Optional[str] = "local"

    class Config:
        from_attributes = True

class WorkoutListResponse(BaseModel):
    id: str
    title: str
    timestamp: datetime
    duration_seconds: float
    distance_meters: float
    average_power: Optional[float] = None
    average_hr: Optional[float] = None
    tss: Optional[float] = None
    tss_type: Optional[str] = None
    np: Optional[float] = None
    if_factor: Optional[float] = None
    ef: Optional[float] = None
    is_merged: bool
    real_power_present: bool
    estimated_power_present: bool
    hr_present: bool
    source: Optional[str] = "local"
    strava_id: Optional[str] = None

    class Config:
        from_attributes = True

class WorkoutDetailResponse(WorkoutListResponse):
    max_power: Optional[float] = None
    max_hr: Optional[int] = None
    average_cadence: Optional[float] = None
    total_elevation_gain: Optional[float] = None
    calories: Optional[float] = None
    np: Optional[float] = None
    if_factor: Optional[float] = None
    peak_20min_power: Optional[float] = None
    w_prime_min: Optional[float] = None
    matches_burned: Optional[int] = None
    vi: Optional[float] = None
    ef: Optional[float] = None
    aerobic_decoupling: Optional[float] = None
    vo2max_est: Optional[float] = None
    aerobic_work_kj: Optional[float] = None
    anaerobic_work_kj: Optional[float] = None
    source_file_ids: list[str] = []

    class Config:
        from_attributes = True

class WorkoutStreamResponse(BaseModel):
    workout_id: str
    stream_data: list[dict]

    class Config:
        from_attributes = True

class MergeRequest(BaseModel):
    file_id_1: str
    file_id_2: str
    time_offset_seconds: int = 0  # Offset to apply to file 2 relative to file 1
    title: str = "Merged Workout"

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

class ChatResponse(BaseModel):
    response: str

class DashboardSummaryResponse(BaseModel):
    ctl: float
    atl: float
    tsb: float
    weekly_load: float
    weekly_hours: float
    weekly_capacity: float
    goal_progress_percent: float
    recent_workouts: list[WorkoutListResponse]
    season_distance_km: float = 0.0
    season_ascent_m: float = 0.0
    eftp: float = 0.0
    cp: float = 0.0
    w_prime: float = 0.0
    peak_vam: float = 0.0

class WorkoutUpdateSchema(BaseModel):
    title: Optional[str] = None
    timestamp: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    distance_meters: Optional[float] = None
    average_power: Optional[float] = None
    max_power: Optional[float] = None
    average_hr: Optional[float] = None
    max_hr: Optional[int] = None
    average_cadence: Optional[float] = None
    total_elevation_gain: Optional[float] = None
    calories: Optional[float] = None
    tss: Optional[float] = None

class WorkoutSyncPayload(BaseModel):
    title: Optional[str] = "Harjoitus"
    timestamp: Optional[datetime] = None
    duration_seconds: Optional[float] = 0.0
    distance_meters: Optional[float] = 0.0
    average_power: Optional[float] = None
    max_power: Optional[float] = None
    average_hr: Optional[float] = None
    max_hr: Optional[int] = None
    average_cadence: Optional[float] = None
    total_elevation_gain: Optional[float] = None
    calories: Optional[float] = None
    tss: Optional[float] = None
    np: Optional[float] = None
    if_factor: Optional[float] = None
    peak_20min_power: Optional[float] = None
    external_id: Optional[str] = None
    overwrite: Optional[bool] = False

class SyncResultResponse(BaseModel):
    status: str  # 'created', 'updated', 'duplicate_found'
    message: str
    workout: Optional[WorkoutDetailResponse] = None

class SyncServerRequest(BaseModel):
    server_url: str
    api_key: Optional[str] = ""

class ManualWorkoutRequest(BaseModel):
    title: str = "Manuaalinen harjoitus"
    timestamp: Optional[str] = None
    duration_seconds: float = 0.0
    distance_meters: float = 0.0
    tss: Optional[float] = 0.0
    np: Optional[float] = 0.0
    average_hr: Optional[float] = None
