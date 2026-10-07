"""
Feedback model — users correct AI predictions; feeds ML improvement queue.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class ScanFeedback(Base):
    __tablename__ = "scan_feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    scan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("waste_scans.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Original AI prediction
    predicted_category: Mapped[str] = mapped_column(String(100), nullable=False)

    # User's correction (if different from prediction)
    corrected_category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Was the AI prediction correct?
    is_correct: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional free-text comment
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Star rating 1–5
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Has this been reviewed for ML training?
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ScanFeedback id={self.id} scan_id={self.scan_id} "
            f"correct={self.is_correct!r}>"
        )
