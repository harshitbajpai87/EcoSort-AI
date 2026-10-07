"""
backend/app/api/v1/notifications.py
=====================================
In-app notification endpoints.

GET  /api/v1/notifications/           — list my notifications
PATCH /api/v1/notifications/{id}/read — mark one as read
POST /api/v1/notifications/read-all   — mark all as read
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    title: str
    body: str
    category: str
    read: bool
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[NotificationResponse], summary="List my notifications")
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationResponse]:
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        NotificationResponse(
            id=n.id,
            title=n.title,
            body=n.body,
            category=n.category,
            read=n.read,
            created_at=n.created_at.isoformat(),
        )
        for n in notifs
    ]


@router.patch("/{notif_id}/read", summary="Mark a notification as read")
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.read = True
    db.commit()
    return {"message": "Marked as read."}


@router.post("/read-all", summary="Mark all notifications as read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False,
    ).update({"read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.get("/unread-count", summary="Count of unread notifications")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False,
    ).count()
    return {"unread_count": count}
