"""
EcoPointEvent model — audit log of all point transactions.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class EcoPointEvent(Base):
    __tablename__ = "eco_point_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Points change (positive = earned, negative = spent)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)

    # "scan", "pickup", "challenge", "admin_grant"
    reason: Mapped[str] = mapped_column(String(100), nullable=False)

    # Optional reference to the source entity
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<EcoPointEvent user={self.user_id} delta={self.delta} reason={self.reason!r}>"
