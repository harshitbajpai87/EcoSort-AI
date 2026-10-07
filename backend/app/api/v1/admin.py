"""
backend/app/api/v1/admin.py
============================
Admin-only endpoints (require ADMIN role).

GET    /api/v1/admin/stats             — platform-wide statistics
GET    /api/v1/admin/users             — list all users
GET    /api/v1/admin/users/{id}        — get user by id
PATCH  /api/v1/admin/users/{id}/role   — change user role
DELETE /api/v1/admin/users/{id}        — deactivate user
GET    /api/v1/admin/pickups           — list all pickups
PATCH  /api/v1/admin/pickups/{id}/status — update any pickup status
GET    /api/v1/admin/scans             — list all scans (global)
GET    /api/v1/admin/feedbacks         — list all feedback items
PATCH  /api/v1/admin/feedbacks/{id}/review — mark feedback reviewed
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.database.session import get_db
from app.models.user import User
from app.models.waste_scan import WasteScan
from app.models.pickup_request import PickupRequest
from app.models.feedback import ScanFeedback
from app.models.notification import Notification
from app.models.eco_point_event import EcoPointEvent

router = APIRouter(prefix="/admin", tags=["Admin"])

VALID_ROLES = {"USER", "COLLECTOR", "ADMIN"}
VALID_STATUSES = {"pending", "confirmed", "completed", "cancelled"}


# ── Schemas ────────────────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    total_users: int
    total_scans: int
    total_pickups: int
    pending_pickups: int
    completed_pickups: int
    total_feedbacks: int
    incorrect_predictions: int


class UserSummary(BaseModel):
    id: int
    name: str
    email: str
    role: str
    eco_points: int
    created_at: str


class RoleUpdateRequest(BaseModel):
    role: str = Field(..., description="USER | COLLECTOR | ADMIN")


class PickupSummary(BaseModel):
    id: int
    user_id: int
    waste_category: str
    quantity_kg: float
    address: str
    status: str
    created_at: str


class StatusUpdateRequest(BaseModel):
    status: str


class FeedbackSummary(BaseModel):
    id: int
    user_id: int
    scan_id: int | None
    predicted_category: str
    corrected_category: str | None
    is_correct: bool
    comment: str | None
    rating: int | None
    reviewed: bool
    created_at: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _user_to_summary(u: User) -> UserSummary:
    return UserSummary(
        id=u.id,
        name=u.name,
        email=u.email,
        role=u.role,
        eco_points=u.eco_points,
        created_at=u.created_at.isoformat(),
    )


def _pickup_to_summary(p: PickupRequest) -> PickupSummary:
    return PickupSummary(
        id=p.id,
        user_id=p.user_id,
        waste_category=p.waste_category,
        quantity_kg=p.quantity_kg,
        address=p.address,
        status=p.status,
        created_at=p.created_at.isoformat(),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStats, summary="Platform-wide statistics")
def admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> AdminStats:
    return AdminStats(
        total_users=db.query(User).count(),
        total_scans=db.query(WasteScan).count(),
        total_pickups=db.query(PickupRequest).count(),
        pending_pickups=db.query(PickupRequest).filter(PickupRequest.status == "pending").count(),
        completed_pickups=db.query(PickupRequest).filter(PickupRequest.status == "completed").count(),
        total_feedbacks=db.query(ScanFeedback).count(),
        incorrect_predictions=db.query(ScanFeedback).filter(ScanFeedback.is_correct == False).count(),
    )


@router.get("/users", response_model=list[UserSummary], summary="List all users")
def admin_list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserSummary]:
    offset = (page - 1) * limit
    users = db.query(User).order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return [_user_to_summary(u) for u in users]


@router.get("/users/{user_id}", response_model=UserSummary, summary="Get user by ID")
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserSummary:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return _user_to_summary(user)


@router.patch("/users/{user_id}/role", response_model=UserSummary, summary="Update user role")
def admin_update_role(
    user_id: int,
    body: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> UserSummary:
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{body.role}'.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    # Prevent self-demotion
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role.")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return _user_to_summary(user)


@router.get("/pickups", response_model=list[PickupSummary], summary="List all pickups")
def admin_list_pickups(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[PickupSummary]:
    q = db.query(PickupRequest)
    if status_filter:
        q = q.filter(PickupRequest.status == status_filter)
    pickups = q.order_by(PickupRequest.created_at.desc()).limit(limit).all()
    return [_pickup_to_summary(p) for p in pickups]


@router.patch("/pickups/{pickup_id}/status", response_model=PickupSummary, summary="Update pickup status")
def admin_update_pickup_status(
    pickup_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> PickupSummary:
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status '{body.status}'.")
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup not found.")
    pickup.status = body.status
    db.commit()
    db.refresh(pickup)
    return _pickup_to_summary(pickup)


@router.get("/feedbacks", response_model=list[FeedbackSummary], summary="List all feedback")
def admin_list_feedbacks(
    reviewed: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[FeedbackSummary]:
    q = db.query(ScanFeedback)
    if reviewed is not None:
        q = q.filter(ScanFeedback.reviewed == reviewed)
    feedbacks = q.order_by(ScanFeedback.created_at.desc()).limit(limit).all()
    return [
        FeedbackSummary(
            id=f.id,
            user_id=f.user_id,
            scan_id=f.scan_id,
            predicted_category=f.predicted_category,
            corrected_category=f.corrected_category,
            is_correct=f.is_correct,
            comment=f.comment,
            rating=f.rating,
            reviewed=f.reviewed,
            created_at=f.created_at.isoformat(),
        )
        for f in feedbacks
    ]


@router.patch("/feedbacks/{feedback_id}/review", summary="Mark feedback as reviewed")
def admin_review_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    fb = db.query(ScanFeedback).filter(ScanFeedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found.")
    fb.reviewed = True
    db.commit()
    return {"message": "Feedback marked as reviewed.", "id": feedback_id}


@router.post("/notifications/broadcast", summary="Broadcast notification to all users")
def broadcast_notification(
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    title = body.get("title", "")
    message = body.get("body", body.get("message", ""))
    if not title or not message:
        raise HTTPException(status_code=400, detail="title and body are required.")
    users = db.query(User).all()
    for user in users:
        notif = Notification(
            user_id=user.id,
            title=title,
            body=message,
            category="system",
        )
        db.add(notif)
    db.commit()
    return {"message": f"Notification broadcast to {len(users)} users."}
