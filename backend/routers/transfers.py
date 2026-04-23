from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import Optional

router = APIRouter(prefix="/transfers", tags=["transfers"])

@router.post("/log")
async def log_transfer(
    request: Request, 
    data: schemas.TransferLogCreate,
    db: Session = Depends(get_db)
):
    # Get IP address from request
    ip_address = request.client.host
    
    # Handle X-Forwarded-For if behind a proxy like Vercel/Railway
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # X-Forwarded-For: client, proxy1, proxy2
        ip_address = forwarded_for.split(",")[0].strip()
        
    log_entry = models.TransferLog(
        user_id=data.user_id,
        ip_address=ip_address,
        action_type=data.action_type
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    
    return {
        "status": "success",
        "message": f"{data.action_type} action logged",
        "ip": ip_address
    }
