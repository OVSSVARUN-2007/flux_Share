import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# It checks the environment variable first. Default fallback is standard local Postgres. 
# Format: postgresql://user:password@hostname/dbname
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost/flux_share"
)

# Connect args specific to SQLite (check_same_thread) are safely removed for Postgres
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
