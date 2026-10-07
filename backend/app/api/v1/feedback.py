"""
backend/app/api/v1/feedback.py
================================
User feedback on AI scan predictions — corrects wrong classifications
and feeds the ML improvement queue.

POST /api/v1/feedback/              — submit feedback on a scan
GET  /api/v1/feedback/              — list my feedback submissions
GET  /api/v1/feedback/ml-queue      — unreviewed feedback for ML training (admin)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_current_user, require_admin
from app.database.session import get_db
from app.models.feedback import ScanFeedback
from app.models.waste_scan import WasteScan
from app.models.user import User
from app.models.eco_point_event import EcoPointEvent

router = APIRouter(prefix="/feedback", tags=["Feedback"])

SCAN_POINTS = 10       # points for any scan
CORRECTION_POINTS = 5  # bonus for correcting a wrong prediction


# ── Schemas ────────────────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    scan_id: Optional[int] = Field(default=None, description="ID of the scan being rated")
    predicted_category: str = Field(..., min_length=1, max_length=100)
    corrected_category: Optional[str] = Field(default=None, max_length=100)
    is_correct: bool = Field(default=True)
    comment: Optional[str] = Field(default=None, max_length=1000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)


class FeedbackResponse(BaseModel):
    id: int
    scan_id: int | None
    predicted_category: str
    corrected_category: str | None
    is_correct: bool
    rating: int | None
    created_at: str


class MLQueueItem(BaseModel):
    id: int
    scan_id: int | None
    predicted_category: str
    corrected_category: str | None
    comment: str | None
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit feedback on a scan",
)
def submit_feedback(
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackResponse:
    # Validate scan_id if provided
    if body.scan_id:
        scan = db.query(WasteScan).filter(WasteScan.id == body.scan_id).first()
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found.")

    fb = ScanFeedback(
        user_id=current_user.id,
        scan_id=body.scan_id,
        predicted_category=body.predicted_category,
        corrected_category=body.corrected_category,
        is_correct=body.is_correct,
        comment=body.comment,
        rating=body.rating,
    )
    db.add(fb)
    db.flush()

    # Award points for submitting a scan + feedback
    delta = SCAN_POINTS
    if not body.is_correct:
        delta += CORRECTION_POINTS  # bonus for catching a wrong prediction
    current_user.eco_points = (current_user.eco_points or 0) + delta
    event = EcoPointEvent(
        user_id=current_user.id,
        delta=delta,
        reason="scan_feedback",
        reference_id=body.scan_id,
    )
    db.add(event)
    db.commit()
    db.refresh(fb)

    return FeedbackResponse(
        id=fb.id,
        scan_id=fb.scan_id,
        predicted_category=fb.predicted_category,
        corrected_category=fb.corrected_category,
        is_correct=fb.is_correct,
        rating=fb.rating,
        created_at=fb.created_at.isoformat(),
    )


@router.get("/", response_model=list[FeedbackResponse], summary="List my feedback submissions")
def list_my_feedbacks(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FeedbackResponse]:
    feedbacks = (
        db.query(ScanFeedback)
        .filter(ScanFeedback.user_id == current_user.id)
        .order_by(ScanFeedback.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        FeedbackResponse(
            id=f.id,
            scan_id=f.scan_id,
            predicted_category=f.predicted_category,
            corrected_category=f.corrected_category,
            is_correct=f.is_correct,
            rating=f.rating,
            created_at=f.created_at.isoformat(),
        )
        for f in feedbacks
    ]


@router.get(
    "/ml-queue",
    response_model=list[MLQueueItem],
    summary="ML training queue — unreviewed corrections (admin only)",
)
def ml_queue(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[MLQueueItem]:
    """Returns unreviewed incorrect feedback for ML re-training."""
    items = (
        db.query(ScanFeedback)
        .filter(ScanFeedback.is_correct == False, ScanFeedback.reviewed == False)
        .order_by(ScanFeedback.created_at.asc())
        .limit(limit)
        .all()
    )
    return [
        MLQueueItem(
            id=i.id,
            scan_id=i.scan_id,
            predicted_category=i.predicted_category,
            corrected_category=i.corrected_category,
            comment=i.comment,
            created_at=i.created_at.isoformat(),
        )
        for i in items
    ]
