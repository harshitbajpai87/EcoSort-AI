"""
PickupRequest model — a user-submitted request for waste collection.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class PickupRequest(Base):
    __tablename__ = "pickup_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Matches the predicted_category values used in WasteScan
    waste_category: Mapped[str] = mapped_column(String(100), nullable=False)

    # Estimated weight of the waste batch in kilograms
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)

    # Free-text collection address entered by the user
    address: Mapped[str] = mapped_column(String(500), nullable=False)

    # Lifecycle: pending → confirmed → completed  (or cancelled)
    status: Mapped[str] = mapped_column(
        Enum("pending", "confirmed", "completed", "cancelled", name="pickup_status"),
        default="pending",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<PickupRequest id={self.id} user_id={self.user_id} "
            f"category={self.waste_category!r} status={self.status!r}>"
        )
