from sqlalchemy import Boolean, Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True) # Null for Google-only users
    google_id = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TransferLog(Base):
    __tablename__ = "transfer_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True) # ID of logged in user, or Null
    ip_address = Column(String, index=True)
    action_type = Column(String) # 'send' or 'receive'
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
