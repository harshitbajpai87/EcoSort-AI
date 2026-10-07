"""
backend/app/api/v1/classifications.py
=======================================
POST /api/v1/classifications/predict
    — accepts an image upload, runs the ML service, persists the result,
      awards EcoPoints, and returns a structured JSON response.

GET  /api/v1/classifications/
    — lists the authenticated user's scan records (newest first).

POST /api/v1/classifications/{id}/feedback
    — quick inline feedback route (redirects to feedback module).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_token
from app.database.session import get_db
from app.models.waste_scan import WasteScan
from app.models.user import User
from app.models.eco_point_event import EcoPointEvent
from app.services.ml_service import classify_image

router = APIRouter(prefix="/classifications", tags=["Classifications"])
settings = get_settings()
_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

SCAN_ECO_POINTS = 10  # points awarded per scan

# ---------------------------------------------------------------------------
# Allowed image MIME types
# ---------------------------------------------------------------------------
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Response schema (what the API returns as JSON)
# ---------------------------------------------------------------------------

class ClassificationResponse(BaseModel):
    scan_id: int = Field(..., description="Auto-assigned database ID for this scan")
    predicted_category: str = Field(..., description="Waste category identified by the model")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence (0–1)")
    confidence_pct: str = Field(..., description="Human-readable confidence, e.g. '94.2 %'")
    recommended_bin: str = Field(..., description="Bin colour / disposal point")
    is_hazardous: bool = Field(..., description="True when item requires special handling")
    instructions: str = Field(..., description="Step-by-step disposal instructions")
    source: str = Field(..., description="'model' if a checkpoint was used, 'heuristic' otherwise")
    scanned_at: datetime = Field(..., description="UTC timestamp of this classification")

    model_config = {"from_attributes": True}


class ScanSummary(BaseModel):
    scan_id: int
    predicted_category: str
    confidence_pct: str
    recommended_bin: str
    is_hazardous: bool
    scanned_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# POST /api/v1/classifications/predict
# ---------------------------------------------------------------------------

@router.post(
    "/predict",
    response_model=ClassificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Classify a waste image",
    description=(
        "Upload a PNG, JPEG, or WebP image (max 10 MB). "
        "The service returns the predicted waste category, "
        "recommended disposal bin, hazard flag, and step-by-step instructions. "
        "The result is automatically saved to the database. "
        "Authenticated users earn EcoPoints for each scan."
    ),
)
def predict(
    file: UploadFile = File(..., description="Waste image to classify (PNG / JPG / WebP)"),
    token: Optional[str] = Depends(_oauth2),
    db: Session = Depends(get_db),
) -> ClassificationResponse:
    # --- Resolve user from optional JWT ---
    resolved_user: Optional[User] = None
    if token:
        try:
            payload = decode_token(token)
            if payload.get("type") == "access":
                uid = payload.get("sub")
                if uid:
                    resolved_user = db.query(User).filter(User.id == int(uid)).first()
        except JWTError:
            pass  # anonymous scan is fine

    # --- Validate content type ---
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{content_type}'. "
                f"Please upload a PNG, JPEG, or WebP image."
            ),
        )

    # --- Read and size-check the file ---
    image_bytes = file.file.read()
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds the 10 MB size limit.",
        )
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # --- Run classification ---
    try:
        result = classify_image(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not process image: {exc}",
        )

    # --- Persist to database ---
    scan = WasteScan(
        user_id=resolved_user.id if resolved_user else None,
        predicted_category=result.category,
        confidence=result.confidence,
        recommended_bin=result.bin_colour,
        is_hazardous=result.is_hazardous,
        instructions=result.instructions,
        created_at=datetime.now(timezone.utc),
    )
    db.add(scan)

    # --- Award EcoPoints to authenticated users ---
    if resolved_user:
        resolved_user.eco_points = (resolved_user.eco_points or 0) + SCAN_ECO_POINTS
        event = EcoPointEvent(
            user_id=resolved_user.id,
            delta=SCAN_ECO_POINTS,
            reason="scan",
            reference_id=None,
        )
        db.add(event)

    db.commit()
    db.refresh(scan)

    return ClassificationResponse(
        scan_id=scan.id,
        predicted_category=result.category,
        confidence=result.confidence,
        confidence_pct=f"{result.confidence * 100:.1f} %",
        recommended_bin=result.bin_colour,
        is_hazardous=result.is_hazardous,
        instructions=result.instructions,
        source=result.source,
        scanned_at=scan.created_at,
    )


# ---------------------------------------------------------------------------
# GET /api/v1/classifications/
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[ScanSummary],
    summary="List authenticated user's scan results",
    description=(
        "Returns the authenticated user's waste scan records (newest first). "
        "Admins and unauthenticated requests see all recent scans."
    ),
)
def list_scans(
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
    token: Optional[str] = Depends(_oauth2),
    db: Session = Depends(get_db),
) -> list[ScanSummary]:
    # Resolve user from optional JWT
    user_id_filter: Optional[int] = None
    user_role: str = "USER"
    if token:
        try:
            payload = decode_token(token)
            if payload.get("type") == "access":
                uid = payload.get("sub")
                user_role = payload.get("role", "USER")
                if uid:
                    user_id_filter = int(uid)
        except JWTError:
            pass

    q = db.query(WasteScan)
    # Non-admin users see only their own scans
    if user_role not in ("ADMIN",) and user_id_filter is not None:
        q = q.filter(WasteScan.user_id == user_id_filter)

    scans = q.order_by(WasteScan.created_at.desc()).limit(limit).all()
    return [
        ScanSummary(
            scan_id=s.id,
            predicted_category=s.predicted_category,
            confidence_pct=f"{s.confidence * 100:.1f} %",
            recommended_bin=s.recommended_bin,
            is_hazardous=s.is_hazardous,
            scanned_at=s.created_at,
        )
        for s in scans
    ]
