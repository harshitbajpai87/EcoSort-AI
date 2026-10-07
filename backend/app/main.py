"""
backend/app/main.py
====================
EcoSort AI FastAPI application entry point.
All routers and middleware are registered here.
Tables are auto-created on startup via SQLAlchemy metadata.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.v1.auth import router as auth_router
from app.api.v1.classifications import router as classifications_router
from app.api.v1.chat import router as chat_router
from app.api.v1.pickups import router as pickups_router
from app.api.v1.ecopoints import router as ecopoints_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.admin import router as admin_router
from app.api.v1.feedback import router as feedback_router
from app.api.v1.recycling_centers import router as recycling_centers_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.challenges import router as challenges_router
from app.database.session import Base, engine

# Import all models so SQLAlchemy registers their metadata
import app.models.user              # noqa: F401
import app.models.waste_scan        # noqa: F401
import app.models.pickup_request    # noqa: F401
import app.models.notification      # noqa: F401
import app.models.feedback          # noqa: F401
import app.models.recycling_center  # noqa: F401
import app.models.challenge         # noqa: F401
import app.models.eco_point_event   # noqa: F401

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Startup safety check ──────────────────────────────────────────────────────
_WEAK_KEY = "change-me-in-production-use-a-long-random-string"
if settings.SECRET_KEY == _WEAK_KEY:
    logger.warning(
        "⚠️  SECRET_KEY is set to the default insecure value! "
        "Set a strong SECRET_KEY environment variable before deploying to production. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

# Auto-create all tables (idempotent — no-op if they already exist)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EcoSort AI",
    description=(
        "AI-powered Smart Waste Management Platform. "
        "Features: waste classification, eco-points, gamification, "
        "pickup management, recycling center locator, and IBM watsonx.ai EcoChat. "
        "Aligned with UN SDGs 11, 12, and 13."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow the React frontend and any configured production origins
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
_V1 = "/api/v1"

app.include_router(auth_router,              prefix=_V1)
app.include_router(classifications_router,   prefix=_V1)
app.include_router(chat_router,              prefix=_V1)
app.include_router(pickups_router,           prefix=_V1)
app.include_router(ecopoints_router,         prefix=_V1)
app.include_router(analytics_router,         prefix=_V1)
app.include_router(admin_router,             prefix=_V1)
app.include_router(feedback_router,          prefix=_V1)
app.include_router(recycling_centers_router, prefix=_V1)
app.include_router(notifications_router,     prefix=_V1)
app.include_router(challenges_router,        prefix=_V1)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/v1/health", tags=["Health"])
def health_check():
    """Returns a simple status message so you can verify the server is up."""
    return {
        "status": "ok",
        "service": "EcoSort AI",
        "version": "1.0.0",
        "sdgs": ["SDG 11", "SDG 12", "SDG 13"],
    }
