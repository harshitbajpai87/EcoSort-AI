"""
backend/app/api/v1/analytics.py
================================
Analytics and dashboard statistics endpoints.

GET /api/v1/analytics/dashboard   — aggregate stats for the logged-in user
GET /api/v1/analytics/impact      — environmental impact calculations
GET /api/v1/analytics/ml          — ML model accuracy metrics
"""

from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.waste_scan import WasteScan
from app.models.pickup_request import PickupRequest
from app.models.feedback import ScanFeedback

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# ── CO₂ factors (kg CO₂ saved per kg of waste diverted from landfill) ─────────
CO2_FACTORS: dict[str, float] = {
    "plastic":   2.5,
    "paper":     1.1,
    "cardboard": 1.1,
    "glass":     0.3,
    "metal":     4.0,
    "organic":   0.5,
    "textile":   5.5,
    "e-waste":   20.0,
    "battery":   6.0,
    "hazardous": 3.0,
}

# Approximate weight per scan (kg) — used to estimate diversion
WEIGHT_MAP: dict[str, float] = {
    "plastic":   0.3,
    "paper":     0.5,
    "cardboard": 1.2,
    "glass":     0.8,
    "metal":     0.4,
    "organic":   0.6,
    "textile":   0.7,
    "e-waste":   1.5,
    "battery":   0.2,
    "hazardous": 0.5,
}


# ── Schemas ────────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_scans: int
    total_waste_diverted_kg: float
    eco_points: int
    hazardous_count: int
    scans_by_category: dict[str, int]
    total_pickups: int
    completed_pickups: int


class ImpactStats(BaseModel):
    total_waste_kg: float
    co2_saved_kg: float
    trees_equivalent: float   # 1 tree absorbs ~21 kg CO₂/year
    plastic_bottles_equivalent: float  # avg PET bottle ~30g
    energy_saved_kwh: float  # rough estimate


class MLMetrics(BaseModel):
    total_feedbacks: int
    correct_predictions: int
    incorrect_predictions: int
    accuracy_pct: float
    top_error_categories: list[dict]
    pending_review: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardStats, summary="User dashboard statistics")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardStats:
    scans = (
        db.query(WasteScan)
        .filter(WasteScan.user_id == current_user.id)
        .all()
    )
    pickups = (
        db.query(PickupRequest)
        .filter(PickupRequest.user_id == current_user.id)
        .all()
    )

    total_scans = len(scans)
    hazardous_count = sum(1 for s in scans if s.is_hazardous)
    waste_kg = sum(WEIGHT_MAP.get(s.predicted_category, 0.4) for s in scans)
    by_cat = Counter(s.predicted_category for s in scans)
    completed = sum(1 for p in pickups if p.status == "completed")

    return DashboardStats(
        total_scans=total_scans,
        total_waste_diverted_kg=round(waste_kg, 2),
        eco_points=current_user.eco_points,
        hazardous_count=hazardous_count,
        scans_by_category=dict(by_cat),
        total_pickups=len(pickups),
        completed_pickups=completed,
    )


@router.get("/impact", response_model=ImpactStats, summary="Environmental impact calculations")
def impact_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImpactStats:
    scans = (
        db.query(WasteScan)
        .filter(WasteScan.user_id == current_user.id)
        .all()
    )

    total_kg = 0.0
    co2_saved = 0.0
    for s in scans:
        kg = WEIGHT_MAP.get(s.predicted_category, 0.4)
        total_kg += kg
        co2_saved += kg * CO2_FACTORS.get(s.predicted_category, 1.0)

    return ImpactStats(
        total_waste_kg=round(total_kg, 2),
        co2_saved_kg=round(co2_saved, 2),
        trees_equivalent=round(co2_saved / 21.0, 2),
        plastic_bottles_equivalent=round(total_kg / 0.03, 1),
        energy_saved_kwh=round(co2_saved * 1.5, 2),
    )


@router.get("/ml", response_model=MLMetrics, summary="ML model accuracy metrics (admin)")
def ml_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MLMetrics:
    """Returns feedback-based ML accuracy metrics. Available to all authenticated users."""
    feedbacks = db.query(ScanFeedback).all()
    total = len(feedbacks)
    correct = sum(1 for f in feedbacks if f.is_correct)
    incorrect = total - correct
    accuracy = (correct / total * 100) if total > 0 else 0.0
    pending = sum(1 for f in feedbacks if not f.reviewed)

    # Top error categories
    errors = Counter(
        f.predicted_category for f in feedbacks
        if not f.is_correct and f.predicted_category
    )
    top_errors = [
        {"category": cat, "count": cnt}
        for cat, cnt in errors.most_common(5)
    ]

    return MLMetrics(
        total_feedbacks=total,
        correct_predictions=correct,
        incorrect_predictions=incorrect,
        accuracy_pct=round(accuracy, 2),
        top_error_categories=top_errors,
        pending_review=pending,
    )
