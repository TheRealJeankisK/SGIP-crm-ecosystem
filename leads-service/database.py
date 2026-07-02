from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import settings
import time

# Create DB engine with automatic retry for initialization stability
engine = None
for i in range(5):
    try:
        engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        break
    except Exception as e:
        print(f"Database connection attempt {i+1} failed. Retrying in 3 seconds... Error: {e}")
        time.sleep(3)

if engine is None:
    # Final try to fail gracefully or let FastAPI fail on startup
    engine = create_engine(settings.database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
