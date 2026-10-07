"""
backend/app/api/v1/recycling_centers.py
=========================================
Recycling center locator endpoints.

GET  /api/v1/recycling-centers/        — list all centers (with optional category filter)
GET  /api/v1/recycling-centers/{id}    — get a specific center
POST /api/v1/recycling-centers/        — add a center (admin only)
PUT  /api/v1/recycling-centers/{id}    — update a center (admin only)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_current_user, require_admin
from app.database.session import get_db
from app.models.recycling_center import RecyclingCenter
from app.models.user import User

router = APIRouter(prefix="/recycling-centers", tags=["Recycling Centers"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class CenterResponse(BaseModel):
    id: int
    name: str
    address: str
    accepted_categories: list[str]
    latitude: float | None
    longitude: float | None
    opening_hours: str | None
    phone: str | None
    website: str | None


class CreateCenterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    address: str = Field(..., min_length=5, max_length=500)
    accepted_categories: list[str] = Field(default_factory=list)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    opening_hours: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    website: Optional[str] = Field(default=None, max_length=255)


# ── Helper ─────────────────────────────────────────────────────────────────────

def _to_response(c: RecyclingCenter) -> CenterResponse:
    cats = [s.strip() for s in c.accepted_categories.split(",") if s.strip()]
    return CenterResponse(
        id=c.id,
        name=c.name,
        address=c.address,
        accepted_categories=cats,
        latitude=c.latitude,
        longitude=c.longitude,
        opening_hours=c.opening_hours,
        phone=c.phone,
        website=c.website,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[CenterResponse], summary="List recycling centers")
def list_centers(
    category: Optional[str] = Query(default=None, description="Filter by accepted waste category"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CenterResponse]:
    centers = db.query(RecyclingCenter).all()
    if category:
        centers = [c for c in centers if category.lower() in c.accepted_categories.lower()]
    return [_to_response(c) for c in centers]


@router.get("/{center_id}", response_model=CenterResponse, summary="Get recycling center by ID")
def get_center(
    center_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CenterResponse:
    center = db.query(RecyclingCenter).filter(RecyclingCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Recycling center not found.")
    return _to_response(center)


@router.post(
    "/",
    response_model=CenterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a recycling center (admin)",
)
def create_center(
    body: CreateCenterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> CenterResponse:
    center = RecyclingCenter(
        name=body.name,
        address=body.address,
        accepted_categories=",".join(body.accepted_categories),
        latitude=body.latitude,
        longitude=body.longitude,
        opening_hours=body.opening_hours,
        phone=body.phone,
        website=body.website,
    )
    db.add(center)
    db.commit()
    db.refresh(center)
    return _to_response(center)


@router.put(
    "/{center_id}",
    response_model=CenterResponse,
    summary="Update a recycling center (admin)",
)
def update_center(
    center_id: int,
    body: CreateCenterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> CenterResponse:
    center = db.query(RecyclingCenter).filter(RecyclingCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Recycling center not found.")
    center.name = body.name
    center.address = body.address
    center.accepted_categories = ",".join(body.accepted_categories)
    center.latitude = body.latitude
    center.longitude = body.longitude
    center.opening_hours = body.opening_hours
    center.phone = body.phone
    center.website = body.website
    db.commit()
    db.refresh(center)
    return _to_response(center)
