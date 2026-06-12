"""Admin/Teacher user ORM model."""

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    """User role enumeration."""
    ADMIN = "admin"
    TEACHER = "teacher"


class User(Base):
    """Admin or teacher user account."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.TEACHER
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"
