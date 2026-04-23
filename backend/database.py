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

# IMPORTANT BUGFIX: Cloud databases (Railway/Heroku) often use old prefix `postgres://`
# Modern Python SQL engines explicitly require `postgresql://`, leading to invisible 500 crashes
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={'connect_timeout': 3}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
