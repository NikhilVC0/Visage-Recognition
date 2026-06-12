"""Attendance record and session ORM models."""

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventType(str, enum.Enum):
    """Type of attendance event."""
    ENTRY = "entry"
    EXIT = "exit"


class AttendanceSession(Base):
    """A class session during which attendance is tracked."""

    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_name: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="e.g., 'CS101 - Data Structures - Period 1'",
    )
    class_name: Mapped[str] = mapped_column(String(100), nullable=True)
    date: Mapped[date] = mapped_column(
        Date, nullable=False, default=lambda: datetime.now(timezone.utc).date()
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    camera_id: Mapped[str] = mapped_column(
        String(50), nullable=True, default="cam_default"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    records = relationship(
        "AttendanceRecord", back_populates="session", lazy="selectin"
    )

    def __repr__(self) -> str:
        return (
            f"<AttendanceSession(id={self.id}, name='{self.session_name}', "
            f"date={self.date}, active={self.is_active})>"
        )


class AttendanceRecord(Base):
    """Individual attendance event (entry or exit) for a student."""

    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id"), nullable=False, index=True
    )
    session_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("attendance_sessions.id"), nullable=True, index=True
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType), nullable=False, default=EventType.ENTRY
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    confidence_score: Mapped[float] = mapped_column(
        Float, nullable=True,
        comment="Face match confidence (cosine similarity) when auto-detected",
    )
    is_manual_override: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    is_spoofing_checked: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
        comment="Whether anti-spoofing was performed for this record",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    student = relationship("Student", back_populates="attendance_records")
    session = relationship("AttendanceSession", back_populates="records")

    def __repr__(self) -> str:
        return (
            f"<AttendanceRecord(id={self.id}, student_id={self.student_id}, "
            f"event='{self.event_type}', time={self.timestamp})>"
        )
