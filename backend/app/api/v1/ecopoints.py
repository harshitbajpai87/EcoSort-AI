"""
backend/app/api/v1/ecopoints.py
================================
EcoPoints and leaderboard endpoints.

GET  /api/v1/ecopoints/me              — current user's balance
GET  /api/v1/ecopoints/leaderboard     — top users by points
GET  /api/v1/ecopoints/history         — current user's point event history
GET  /api/v1/ecopoints/badges/{user_id}— user's earned badges
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.eco_point_event import EcoPointEvent

router = APIRouter(prefix="/ecopoints", tags=["EcoPoints"])

# ── Badge definitions ─────────────────────────────────────────────────────────
# Each badge is unlocked when the user reaches the specified eco_points threshold.

BADGES = [
    {"id": "seedling",      "name": "Seedling",      "emoji": "🌱", "threshold": 10,   "description": "Earned your first EcoPoints!"},
    {"id": "recycler",      "name": "Recycler",      "emoji": "♻️", "threshold": 50,   "description": "Recycled 5+ waste items."},
    {"id": "eco_hero",      "name": "Eco Hero",      "emoji": "🦸", "threshold": 200,  "description": "Reached 200 EcoPoints."},
    {"id": "green_warrior", "name": "Green Warrior", "emoji": "🌿", "threshold": 500,  "description": "Reached 500 EcoPoints."},
    {"id": "planet_saver",  "name": "Planet Saver",  "emoji": "🌍", "threshold": 1000, "description": "Reached 1,000 EcoPoints!"},
    {"id": "eco_champion",  "name": "Eco Champion",  "emoji": "🏆", "threshold": 2500, "description": "Reached 2,500 EcoPoints!"},
    {"id": "sustainability_master", "name": "Sustainability Master", "emoji": "🌟",
     "threshold": 5000, "description": "Reached 5,000 EcoPoints — a true master!"},
]


# ── Schemas ────────────────────────────────────────────────────────────────────

class BalanceResponse(BaseModel):
    user_id: int
    eco_points: int
    badges: list[dict]


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    name: str
    eco_points: int
    badges: list[dict]


class PointEventResponse(BaseModel):
    id: int
    delta: int
    reason: str
    reference_id: int | None
    created_at: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _earned_badges(points: int) -> list[dict]:
    return [b for b in BADGES if points >= b["threshold"]]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=BalanceResponse, summary="Get my EcoPoints balance and badges")
def get_my_ecopoints(
    current_user: User = Depends(get_current_user),
) -> BalanceResponse:
    return BalanceResponse(
        user_id=current_user.id,
        eco_points=current_user.eco_points,
        badges=_earned_badges(current_user.eco_points),
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry], summary="Global leaderboard")
def get_leaderboard(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeaderboardEntry]:
    users = (
        db.query(User)
        .order_by(User.eco_points.desc())
        .limit(limit)
        .all()
    )
    return [
        LeaderboardEntry(
            rank=i + 1,
            user_id=u.id,
            name=u.name,
            eco_points=u.eco_points,
            badges=_earned_badges(u.eco_points),
        )
        for i, u in enumerate(users)
    ]


@router.get("/history", response_model=list[PointEventResponse], summary="My point event history")
def get_my_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PointEventResponse]:
    events = (
        db.query(EcoPointEvent)
        .filter(EcoPointEvent.user_id == current_user.id)
        .order_by(EcoPointEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        PointEventResponse(
            id=e.id,
            delta=e.delta,
            reason=e.reason,
            reference_id=e.reference_id,
            created_at=e.created_at.isoformat(),
        )
        for e in events
    ]


@router.get("/badges/{user_id}", response_model=list[dict], summary="Get a user's earned badges")
def get_user_badges(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found.")
    return _earned_badges(user.eco_points)
