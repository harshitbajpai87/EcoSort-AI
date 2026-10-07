"""
tests/conftest.py
==================
Shared pytest fixtures: in-memory SQLite + FastAPI test client.

Uses per-test transaction rollback for full isolation without recreating
the schema on every test (avoids SQLite Enum-type caching issues).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Import all models so their tables are registered with Base.metadata
import app.models.user              # noqa: F401
import app.models.waste_scan        # noqa: F401
import app.models.pickup_request    # noqa: F401
import app.models.notification      # noqa: F401
import app.models.feedback          # noqa: F401
import app.models.recycling_center  # noqa: F401
import app.models.challenge         # noqa: F401
import app.models.eco_point_event   # noqa: F401

from app.database.session import Base, get_db
from app.api.v1.auth import _rate_store
from app.main import app

# ── Single engine + schema created once per session ───────────────────────────

TEST_DATABASE_URL = "sqlite:///:memory:"
_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=_engine)

# A session factory bound to the test engine
_TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

# ── Per-test DB session (shared with app via override) ────────────────────────

_current_session: Session | None = None


def override_get_db():
    """Yield the current test session so the app uses the same connection."""
    assert _current_session is not None, "No active test session"
    yield _current_session


@pytest.fixture(scope="function")
def client():
    """
    Yields a TestClient.  All DB writes are rolled back after each test so the
    schema never needs to be recreated and tests are fully isolated.
    """
    global _current_session

    connection = _engine.connect()
    transaction = connection.begin()
    session = _TestingSession(bind=connection)
    _current_session = session

    # Reset rate limiter state so tests don't interfere with each other
    _rate_store.clear()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

    session.close()
    transaction.rollback()
    connection.close()
    _current_session = None
    app.dependency_overrides.clear()
