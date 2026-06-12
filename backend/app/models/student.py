"""Student ORM model with face embedding storage."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    """Registered student with face embedding for recognition."""

    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True,
        comment="Institution-assigned student ID (e.g., 'STU-2026-001')",
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    class_name: Mapped[str] = mapped_column(String(100), nullable=True)
    section: Mapped[str] = mapped_column(String(100), nullable=True)
    year: Mapped[int] = mapped_column(Integer, nullable=True)

    # Face recognition data — stored as binary blob (serialised numpy array)
    face_embedding: Mapped[bytes | None] = mapped_column(
        LargeBinary, nullable=True,
        comment="512-dim ArcFace embedding serialised via numpy.tobytes()",
    )
    embedding_version: Mapped[str] = mapped_column(
        String(50), nullable=True, default="arcface_v1",
        comment="Model version used to generate the embedding",
    )

    # Registration photo path (for admin reference only — not used for matching)
    photo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    registered_at: Mapped[datetime] = mapped_column(
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

    # Relationships
    attendance_records = relationship(
        "AttendanceRecord", back_populates="student", lazy="selectin"
    )

    def __repr__(self) -> str:
        has_face = self.face_embedding is not None
        return (
            f"<Student(id={self.id}, student_id='{self.student_id}', "
            f"name='{self.name}', has_face={has_face})>"
        )
