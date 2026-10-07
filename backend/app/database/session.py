"""
Database session — connects to SQLite (dev) or PostgreSQL (production).

The DATABASE_URL is read from settings / environment variable.
Set DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/ecosort for prod.

Usage anywhere in the app:
    from app.database.session import get_db, engine
    from app.database.session import Base  # for model declarations
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

settings = get_settings()

_db_url = settings.DATABASE_URL

# SQLite requires check_same_thread=False; PostgreSQL does not need it
_connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}

engine = create_engine(
    _db_url,
    connect_args=_connect_args,
    pool_pre_ping=True,   # detect stale connections (important for PostgreSQL)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """All SQLAlchemy models inherit from this class."""
    pass


def get_db():
    """
    FastAPI dependency that yields a database session and
    always closes it when the request is finished.

    Example in a route:
        @app.get("/items")
        def list_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
