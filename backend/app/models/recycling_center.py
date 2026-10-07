"""
RecyclingCenter model — local recycling facilities for the locator feature.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class RecyclingCenter(Base):
    __tablename__ = "recycling_centers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    address: Mapped[str] = mapped_column(String(500), nullable=False)

    # Comma-separated waste categories accepted, e.g. "plastic,glass,metal"
    accepted_categories: Mapped[str] = mapped_column(Text, nullable=False, default="")

    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    opening_hours: Mapped[str | None] = mapped_column(String(255), nullable=True)

    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<RecyclingCenter id={self.id} name={self.name!r}>"
