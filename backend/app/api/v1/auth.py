"""
backend/app/api/v1/auth.py
===========================
Authentication endpoints:
  POST /api/v1/auth/register  — create account
  POST /api/v1/auth/login     — returns access + refresh tokens
  POST /api/v1/auth/refresh   — exchange refresh token for new access token
  GET  /api/v1/auth/me        — return current user profile
  POST /api/v1/auth/logout    — client-side hint (stateless JWT; invalidation is client responsibility)
"""

from __future__ import annotations

import re
import time
from collections import defaultdict
from threading import Lock
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database.session import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()

# ── Simple in-memory rate limiter ─────────────────────────────────────────────
_rate_store: dict[str, list[float]] = defaultdict(list)
_rate_lock = Lock()
_WINDOW = 60.0  # seconds


def _check_rate_limit(key: str, limit: int) -> None:
    """Sliding-window rate limiter keyed by IP + endpoint."""
    now = time.time()
    with _rate_lock:
        timestamps = _rate_store[key]
        # Remove entries outside the window
        _rate_store[key] = [t for t in timestamps if now - t < _WINDOW]
        if len(_rate_store[key]) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a minute and try again.",
            )
        _rate_store[key].append(now)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

MIN_PASSWORD_LENGTH = 8
PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
)


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    phone: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not PASSWORD_PATTERN.match(v):
            raise ValueError(
                "Password must be at least 8 characters and contain "
                "an uppercase letter, a lowercase letter, and a digit."
            )
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    location: Optional[str]
    role: str
    eco_points: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    body: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"register:{client_ip}", settings.AUTH_RATE_LIMIT_PER_MINUTE)

    # Duplicate email check
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email address already exists.",
        )

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        phone=body.phone,
        location=body.location,
        role="USER",
        eco_points=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive JWT tokens",
)
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"login:{client_ip}", settings.AUTH_RATE_LIMIT_PER_MINUTE)

    user = db.query(User).filter(User.email == body.email).first()
    # Use constant-time comparison to avoid timing attacks
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange a refresh token for a new access token",
)
def refresh(
    body: RefreshRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_error
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_error

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get the authenticated user's profile",
)
def me(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        location=current_user.location,
        role=current_user.role,
        eco_points=current_user.eco_points,
        created_at=current_user.created_at.isoformat(),
        updated_at=current_user.updated_at.isoformat(),
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout hint (client should discard tokens)",
)
def logout(_: User = Depends(get_current_user)) -> MessageResponse:
    # JWTs are stateless — real invalidation requires a token blocklist (Redis etc.)
    # This endpoint exists so clients can call a canonical logout URL.
    return MessageResponse(message="Logged out successfully. Please discard your tokens.")
