from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer

import database, models, schemas, auth_utils
import urllib.request
import json
import urllib.error

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

import os

# IMPORTANT: Pulled from .env securely
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

if not GOOGLE_CLIENT_ID:
    print("WARNING: GOOGLE_CLIENT_ID is not set in backend/.env!")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/signup", response_model=schemas.UserResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth_utils.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth_utils.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = auth_utils.create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google", response_model=schemas.Token)
def google_auth(auth: schemas.GoogleAuth, db: Session = Depends(database.get_db)):
    try:
        req = urllib.request.Request("https://www.googleapis.com/oauth2/v3/userinfo")
        req.add_header("Authorization", f"Bearer {auth.token}")
        try:
            with urllib.request.urlopen(req) as response:
                user_info = json.loads(response.read().decode())
        except urllib.error.URLError:
            raise ValueError("Invalid Google access token")
        
        email = user_info.get('email')
        google_id = user_info.get('sub')
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google token: no email provided")
            
        db_user = db.query(models.User).filter(models.User.email == email).first()
        
        if not db_user:
            # Create user if they don't exist
            db_user = models.User(
                email=email,
                google_id=google_id
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        elif not db_user.google_id:
            # Upgrade existing email/password account to also have google_id linked
            db_user.google_id = google_id
            db.commit()
            db.refresh(db_user)
            
        # Create JWT token
        access_token = auth_utils.create_access_token(data={"sub": db_user.email})
        return {"access_token": access_token, "token_type": "bearer"}
        
    except ValueError:
        # Invalid token
        raise HTTPException(status_code=401, detail="Invalid Google authentication token")

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
