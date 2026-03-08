# auth.py — StockSage
# JWT creation, verification, password hashing, auth routes

import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import User, get_db

# ── Config ────────────────────────────────────────────
SECRET_KEY  = os.getenv("JWT_SECRET", "stocksage-dev-secret-change-in-production")
ALGORITHM   = "HS256"
TOKEN_EXPIRY_DAYS = 30

bearer = HTTPBearer()
router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Pydantic schemas ──────────────────────────────────
class SignupRequest(BaseModel):
    name:     str
    email:    str
    password: str

class LoginRequest(BaseModel):
    email:    str
    password: str


# ── Helpers ───────────────────────────────────────────
def hash_password(password: str) -> str:
    # Truncate to 72 bytes — bcrypt hard limit
    return bcrypt.hashpw(password[:72].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain[:72].encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_id: str, email: str, name: str) -> str:
    payload = {
        "sub":   user_id,
        "email": email,
        "name":  name,
        "exp":   datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired. Please log in again.",
        )


# ── Dependency — get current user from JWT ────────────
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


# ── Routes ────────────────────────────────────────────
@router.post("/signup")
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        id            = str(uuid.uuid4()),
        email         = body.email,
        name          = body.name,
        password_hash = hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.id, user.email, user.name)
    return {
        "token":      token,
        "is_new_user": True,
        "user": { "id": user.id, "name": user.name, "email": user.email },
    }


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token(user.id, user.email, user.name)
    return {
        "token":      token,
        "is_new_user": False,
        "user": { "id": user.id, "name": user.name, "email": user.email },
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return { "id": current_user.id, "name": current_user.name, "email": current_user.email }