"""Student Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel, Field


# ── Request Schemas ──────────────────────────────────────────────────────

class StudentCreateRequest(BaseModel):
    """Create a new student."""
    student_id: str = Field(..., min_length=1, max_length=50, description="Unique institution student ID")
    name: str = Field(..., min_length=1, max_length=100)
    email: str | None = Field(None, max_length=255)
    class_name: str | None = Field(None, max_length=100)
    section: str | None = Field(None, max_length=100)
    year: int | None = Field(None, ge=2000, le=2100)
    notes: str | None = None


class StudentUpdateRequest(BaseModel):
    """Update student information (all fields optional)."""
    name: str | None = Field(None, min_length=1, max_length=100)
    email: str | None = Field(None, max_length=255)
    class_name: str | None = Field(None, max_length=100)
    section: str | None = Field(None, max_length=100)
    year: int | None = Field(None, ge=2000, le=2100)
    is_active: bool | None = None
    notes: str | None = None


# ── Response Schemas ─────────────────────────────────────────────────────

class StudentResponse(BaseModel):
    """Student information returned in API responses."""
    id: int
    student_id: str
    name: str
    email: str | None = None
    class_name: str | None = None
    section: str | None = None
    year: int | None = None
    has_face_registered: bool = False
    photo_path: str | None = None
    is_active: bool = True
    registered_at: datetime
    updated_at: datetime
    notes: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_face(cls, student) -> "StudentResponse":
        """Create response indicating whether face embedding exists."""
        return cls(
            id=student.id,
            student_id=student.student_id,
            name=student.name,
            email=student.email,
            class_name=student.class_name,
            section=student.section,
            year=student.year,
            has_face_registered=student.face_embedding is not None,
            photo_path=student.photo_path,
            is_active=student.is_active,
            registered_at=student.registered_at,
            updated_at=student.updated_at,
            notes=student.notes,
        )


class StudentListResponse(BaseModel):
    """Paginated list of students."""
    students: list[StudentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
