"""
Challenge model — community recycling competitions.
ChallengeParticipant — links users to challenges with progress tracking.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)

    description: Mapped[str] = mapped_column(Text, nullable=False)

    # "scan", "pickup", "points" — what the challenge tracks
    challenge_type: Mapped[str] = mapped_column(
        Enum("scan", "pickup", "points", name="challenge_type"),
        default="scan",
        nullable=False,
    )

    # Target value to complete the challenge
    target: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    # EcoPoints reward for completion
    reward_points: Mapped[int] = mapped_column(Integer, default=50, nullable=False)

    # Badge name awarded on completion
    badge: Mapped[str | None] = mapped_column(String(100), nullable=True)

    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Challenge id={self.id} title={self.title!r}>"


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    challenge_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ChallengeParticipant challenge={self.challenge_id} "
            f"user={self.user_id} progress={self.progress}>"
        )
