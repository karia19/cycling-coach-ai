from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

# SQLite connection args for multithreaded access
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
from sqlalchemy import inspect, text

def migrate_db():
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    
    if inspector.has_table("user_parameters"):
        user_cols = [c['name'] for c in inspector.get_columns("user_parameters")]
        with engine.begin() as conn:
            if "cp" not in user_cols:
                conn.execute(text("ALTER TABLE user_parameters ADD COLUMN cp FLOAT DEFAULT 200.0"))
            if "w_prime" not in user_cols:
                conn.execute(text("ALTER TABLE user_parameters ADD COLUMN w_prime FLOAT DEFAULT 20000.0"))
                
    if inspector.has_table("workouts"):
        workout_cols = [c['name'] for c in inspector.get_columns("workouts")]
        with engine.begin() as conn:
            if "w_prime_min" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN w_prime_min FLOAT"))
            if "matches_burned" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN matches_burned INTEGER"))
            if "vi" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN vi FLOAT"))
            if "ef" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN ef FLOAT"))
            if "aerobic_decoupling" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN aerobic_decoupling FLOAT"))
            if "vo2max_est" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN vo2max_est FLOAT"))
            if "aerobic_work_kj" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN aerobic_work_kj FLOAT"))
            if "anaerobic_work_kj" not in workout_cols:
                conn.execute(text("ALTER TABLE workouts ADD COLUMN anaerobic_work_kj FLOAT"))

# Run migration on module import
migrate_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
