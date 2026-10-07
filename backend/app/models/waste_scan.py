"""
WasteScan model — records every AI classification result.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class WasteScan(Base):
    __tablename__ = "waste_scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # The user who submitted the image (nullable so guests can also scan)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # e.g. "plastic", "glass", "organic", "hazardous", "e-waste", "metal", "paper"
    predicted_category: Mapped[str] = mapped_column(String(100), nullable=False)

    # Model confidence score between 0.0 and 1.0
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    # e.g. "Blue Recycling Bin", "Red Hazardous Bin", "Green Compost Bin"
    recommended_bin: Mapped[str] = mapped_column(String(100), nullable=False)

    # True when the item needs special disposal handling
    is_hazardous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Human-readable disposal instructions returned to the user
    instructions: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<WasteScan id={self.id} category={self.predicted_category!r} "
            f"confidence={self.confidence:.2f}>"
        )
