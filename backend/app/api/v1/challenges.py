"""
backend/app/api/v1/challenges.py
==================================
Community challenges and competitions.

GET  /api/v1/challenges/              — list active challenges
GET  /api/v1/challenges/{id}          — get challenge details + leaderboard
POST /api/v1/challenges/{id}/join     — join a challenge
GET  /api/v1/challenges/my            — challenges I'm participating in
POST /api/v1/challenges/              — create a challenge (admin)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.session import get_db
from app.models.challenge import Challenge, ChallengeParticipant
from app.models.user import User
from app.models.waste_scan import WasteScan
from app.models.pickup_request import PickupRequest
from app.models.notification import Notification
from app.models.eco_point_event import EcoPointEvent

router = APIRouter(prefix="/challenges", tags=["Challenges"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ChallengeResponse(BaseModel):
    id: int
    title: str
    description: str
    challenge_type: str
    target: int
    reward_points: int
    badge: str | None
    start_date: str
    end_date: str
    is_active: bool
    participant_count: int


class CreateChallengeRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    challenge_type: str = Field(..., pattern="^(scan|pickup|points)$")
    target: int = Field(..., ge=1)
    reward_points: int = Field(default=50, ge=0)
    badge: Optional[str] = Field(default=None, max_length=100)
    start_date: str
    end_date: str


class ParticipantStatus(BaseModel):
    challenge_id: int
    progress: int
    completed: bool
    completed_at: str | None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _count_participants(db: Session, challenge_id: int) -> int:
    return db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge_id
    ).count()


def _get_user_progress(db: Session, user_id: int, challenge: Challenge) -> int:
    """Calculate current progress based on challenge type."""
    now = datetime.now(timezone.utc)
    start = challenge.start_date
    if start.tzinfo is None:
        from datetime import timezone as tz
        start = start.replace(tzinfo=tz.utc)

    if challenge.challenge_type == "scan":
        return db.query(WasteScan).filter(
            WasteScan.user_id == user_id,
            WasteScan.created_at >= start,
        ).count()
    elif challenge.challenge_type == "pickup":
        return db.query(PickupRequest).filter(
            PickupRequest.user_id == user_id,
            PickupRequest.status == "completed",
            PickupRequest.created_at >= start,
        ).count()
    elif challenge.challenge_type == "points":
        user = db.query(User).filter(User.id == user_id).first()
        return user.eco_points if user else 0
    return 0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ChallengeResponse], summary="List active challenges")
def list_challenges(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ChallengeResponse]:
    now = datetime.now(timezone.utc)
    challenges = (
        db.query(Challenge)
        .filter(Challenge.is_active == True, Challenge.end_date >= now)
        .order_by(Challenge.end_date.asc())
        .all()
    )
    return [
        ChallengeResponse(
            id=c.id,
            title=c.title,
            description=c.description,
            challenge_type=c.challenge_type,
            target=c.target,
            reward_points=c.reward_points,
            badge=c.badge,
            start_date=c.start_date.isoformat(),
            end_date=c.end_date.isoformat(),
            is_active=c.is_active,
            participant_count=_count_participants(db, c.id),
        )
        for c in challenges
    ]


@router.get("/my", response_model=list[ParticipantStatus], summary="My challenge progress")
def my_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ParticipantStatus]:
    participations = (
        db.query(ChallengeParticipant)
        .filter(ChallengeParticipant.user_id == current_user.id)
        .all()
    )
    result = []
    for p in participations:
        challenge = db.query(Challenge).filter(Challenge.id == p.challenge_id).first()
        if not challenge:
            continue
        # Update progress
        progress = _get_user_progress(db, current_user.id, challenge)
        p.progress = progress
        if progress >= challenge.target and not p.completed:
            p.completed = True
            p.completed_at = datetime.now(timezone.utc)
            # Award points
            current_user.eco_points = (current_user.eco_points or 0) + challenge.reward_points
            event = EcoPointEvent(
                user_id=current_user.id,
                delta=challenge.reward_points,
                reason="challenge_completed",
                reference_id=challenge.id,
            )
            db.add(event)
            notif = Notification(
                user_id=current_user.id,
                title=f"Challenge Complete! 🏆 +{challenge.reward_points} pts",
                body=f"You completed '{challenge.title}'! {challenge.reward_points} EcoPoints awarded.",
                category="challenge",
            )
            db.add(notif)
        db.commit()
        result.append(ParticipantStatus(
            challenge_id=p.challenge_id,
            progress=p.progress,
            completed=p.completed,
            completed_at=p.completed_at.isoformat() if p.completed_at else None,
        ))
    return result


@router.post("/{challenge_id}/join", summary="Join a challenge")
def join_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge or not challenge.is_active:
        raise HTTPException(status_code=404, detail="Challenge not found or not active.")
    now = datetime.now(timezone.utc)
    end = challenge.end_date
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if end < now:
        raise HTTPException(status_code=400, detail="This challenge has already ended.")

    existing = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge_id,
        ChallengeParticipant.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already joined this challenge.")

    participant = ChallengeParticipant(
        challenge_id=challenge_id,
        user_id=current_user.id,
        progress=0,
    )
    db.add(participant)
    db.commit()
    return {"message": f"Joined challenge '{challenge.title}' successfully!"}


@router.post(
    "/",
    response_model=ChallengeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a challenge (admin)",
)
def create_challenge(
    body: CreateChallengeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ChallengeResponse:
    try:
        start = datetime.fromisoformat(body.start_date)
        end = datetime.fromisoformat(body.end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601.")
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if end <= start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date.")

    challenge = Challenge(
        title=body.title,
        description=body.description,
        challenge_type=body.challenge_type,
        target=body.target,
        reward_points=body.reward_points,
        badge=body.badge,
        start_date=start,
        end_date=end,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return ChallengeResponse(
        id=challenge.id,
        title=challenge.title,
        description=challenge.description,
        challenge_type=challenge.challenge_type,
        target=challenge.target,
        reward_points=challenge.reward_points,
        badge=challenge.badge,
        start_date=challenge.start_date.isoformat(),
        end_date=challenge.end_date.isoformat(),
        is_active=challenge.is_active,
        participant_count=0,
    )
