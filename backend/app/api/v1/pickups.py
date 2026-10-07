"""
backend/app/api/v1/pickups.py
==============================
Pickup request management endpoints.

USER:
  POST   /api/v1/pickups/           — create a new pickup request
  GET    /api/v1/pickups/           — list the current user's pickups
  GET    /api/v1/pickups/{id}       — get a specific pickup
  PATCH  /api/v1/pickups/{id}/cancel — cancel a pending pickup

COLLECTOR:
  GET    /api/v1/pickups/collector/queue — list all pending/confirmed pickups
  PATCH  /api/v1/pickups/{id}/status    — update pickup status

NOTE: static paths (/collector/queue) are declared BEFORE dynamic paths
      (/{pickup_id}) so FastAPI matches them in the correct order.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models.pickup_request import PickupRequest
from app.models.user import User
from app.models.notification import Notification
from app.models.eco_point_event import EcoPointEvent

router = APIRouter(prefix="/pickups", tags=["Pickups"])

VALID_STATUSES = {"pending", "confirmed", "completed", "cancelled"}
COLLECTOR_ROLES = {"COLLECTOR", "ADMIN"}

# Points awarded for completed pickup
PICKUP_COMPLETE_POINTS = 50


# ── Schemas ────────────────────────────────────────────────────────────────────

class CreatePickupRequest(BaseModel):
    waste_category: str = Field(..., min_length=1, max_length=100)
    quantity_kg: float = Field(..., gt=0, le=10000)
    address: str = Field(..., min_length=5, max_length=500)


class PickupResponse(BaseModel):
    id: int
    user_id: int
    waste_category: str
    quantity_kg: float
    address: str
    status: str
    created_at: str

    model_config = {"from_attributes": True}


class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="pending | confirmed | completed | cancelled")


# ── Helper ─────────────────────────────────────────────────────────────────────

def _to_response(p: PickupRequest) -> PickupResponse:
    return PickupResponse(
        id=p.id,
        user_id=p.user_id,
        waste_category=p.waste_category,
        quantity_kg=p.quantity_kg,
        address=p.address,
        status=p.status,
        created_at=p.created_at.isoformat(),
    )


def _notify(db: Session, user_id: int, title: str, body: str, category: str = "pickup") -> None:
    """Create an in-app notification for the user."""
    notif = Notification(user_id=user_id, title=title, body=body, category=category)
    db.add(notif)


def _award_points(db: Session, user: User, delta: int, reason: str, ref_id: int) -> None:
    """Add eco-points and log the event."""
    user.eco_points = (user.eco_points or 0) + delta
    event = EcoPointEvent(user_id=user.id, delta=delta, reason=reason, reference_id=ref_id)
    db.add(event)


# ── USER endpoints ─────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=PickupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request a waste pickup",
)
def create_pickup(
    body: CreatePickupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PickupResponse:
    pickup = PickupRequest(
        user_id=current_user.id,
        waste_category=body.waste_category,
        quantity_kg=body.quantity_kg,
        address=body.address,
        status="pending",
    )
    db.add(pickup)
    db.flush()
    # Award points for requesting pickup
    _award_points(db, current_user, 5, "pickup_request", pickup.id)
    _notify(
        db, current_user.id,
        "Pickup Requested ✅",
        f"Your {body.waste_category} pickup request (#{pickup.id}) has been received and is pending confirmation.",
    )
    db.commit()
    db.refresh(pickup)
    return _to_response(pickup)


@router.get(
    "/",
    response_model=list[PickupResponse],
    summary="List my pickup requests",
)
def list_my_pickups(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PickupResponse]:
    pickups = (
        db.query(PickupRequest)
        .filter(PickupRequest.user_id == current_user.id)
        .order_by(PickupRequest.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_to_response(p) for p in pickups]


# ── COLLECTOR / ADMIN endpoints ────────────────────────────────────────────────
# IMPORTANT: these static-path routes must come BEFORE /{pickup_id} so FastAPI
# matches /collector/queue before attempting to parse "collector" as an integer.

@router.get(
    "/collector/queue",
    response_model=list[PickupResponse],
    summary="Collector: list pending/confirmed pickups",
)
def collector_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PickupResponse]:
    if current_user.role not in COLLECTOR_ROLES:
        raise HTTPException(status_code=403, detail="Collector or admin role required.")
    pickups = (
        db.query(PickupRequest)
        .filter(PickupRequest.status.in_(["pending", "confirmed"]))
        .order_by(PickupRequest.created_at.asc())
        .all()
    )
    return [_to_response(p) for p in pickups]


@router.patch(
    "/{pickup_id}/status",
    response_model=PickupResponse,
    summary="Collector/Admin: update pickup status",
)
def update_pickup_status(
    pickup_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PickupResponse:
    if current_user.role not in COLLECTOR_ROLES:
        raise HTTPException(status_code=403, detail="Collector or admin role required.")
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status '{body.status}'.")

    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found.")

    old_status = pickup.status
    pickup.status = body.status

    # Fetch the pickup owner for notification / points
    owner = db.query(User).filter(User.id == pickup.user_id).first()

    if body.status == "confirmed" and old_status == "pending":
        _notify(
            db, pickup.user_id,
            "Pickup Confirmed 🚛",
            f"Your pickup request #{pickup_id} ({pickup.waste_category}) has been confirmed!",
        )
    elif body.status == "completed" and old_status == "confirmed":
        if owner:
            _award_points(db, owner, PICKUP_COMPLETE_POINTS, "pickup_completed", pickup_id)
        _notify(
            db, pickup.user_id,
            "Pickup Completed ✅ +50 pts",
            f"Your pickup #{pickup_id} has been completed! You earned {PICKUP_COMPLETE_POINTS} EcoPoints.",
        )
    elif body.status == "cancelled":
        _notify(
            db, pickup.user_id,
            "Pickup Cancelled",
            f"Your pickup request #{pickup_id} has been cancelled by the team.",
        )

    db.commit()
    db.refresh(pickup)
    return _to_response(pickup)


# ── Dynamic-path endpoints — declared AFTER static paths ──────────────────────

@router.get(
    "/{pickup_id}",
    response_model=PickupResponse,
    summary="Get a specific pickup request",
)
def get_pickup(
    pickup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PickupResponse:
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found.")
    # Users can only see their own; collectors/admins can see all
    if current_user.role not in COLLECTOR_ROLES and pickup.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return _to_response(pickup)


@router.patch(
    "/{pickup_id}/cancel",
    response_model=PickupResponse,
    summary="Cancel a pending pickup request",
)
def cancel_pickup(
    pickup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PickupResponse:
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found.")
    if pickup.user_id != current_user.id and current_user.role not in COLLECTOR_ROLES:
        raise HTTPException(status_code=403, detail="Access denied.")
    if pickup.status not in ("pending", "confirmed"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a pickup with status '{pickup.status}'.",
        )
    pickup.status = "cancelled"
    _notify(
        db, pickup.user_id,
        "Pickup Cancelled",
        f"Your pickup request #{pickup_id} has been cancelled.",
    )
    db.commit()
    db.refresh(pickup)
    return _to_response(pickup)
