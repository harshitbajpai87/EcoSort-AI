"""
User model — stores registered accounts and their eco-points tally.
"""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )

    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # "ADMIN" | "COLLECTOR" | "USER"
    role: Mapped[str] = mapped_column(
        Enum("ADMIN", "COLLECTOR", "USER", name="user_role_v2"),
        default="USER",
        nullable=False,
    )

    # Reward points earned from correct classifications and pickups
    eco_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role!r}>"
