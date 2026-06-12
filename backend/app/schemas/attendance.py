"""Attendance Pydantic schemas."""

from datetime import date, datetime
from pydantic import BaseModel, Field


# ── Request Schemas ──────────────────────────────────────────────────────

class AttendanceMarkRequest(BaseModel):
    """Manually mark attendance for a student."""
    student_id: int
    session_id: int | None = None
    event_type: str = Field(default="entry", pattern="^(entry|exit)$")
    notes: str | None = None


class SessionCreateRequest(BaseModel):
    """Create a new attendance session (class period)."""
    session_name: str = Field(..., min_length=1, max_length=200)
    class_name: str | None = Field(None, max_length=100)
    camera_id: str = Field(default="cam_default", max_length=50)
    notes: str | None = None


class SessionEndRequest(BaseModel):
    """End an active attendance session."""
    notes: str | None = None


class AttendanceOverrideRequest(BaseModel):
    """Override an existing attendance record."""
    event_type: str | None = Field(None, pattern="^(entry|exit)$")
    notes: str = Field(..., min_length=1, description="Reason for override")


# ── Response Schemas ─────────────────────────────────────────────────────

class AttendanceRecordResponse(BaseModel):
    """Individual attendance record."""
    id: int
    student_id: int
    student_name: str = ""
    student_student_id: str = ""
    session_id: int | None = None
    event_type: str
    timestamp: datetime
    confidence_score: float | None = None
    is_manual_override: bool = False
    is_spoofing_checked: bool = True
    notes: str | None = None

    model_config = {"from_attributes": True}


class AttendanceLogResponse(BaseModel):
    """Paginated attendance log response."""
    records: list[AttendanceRecordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SessionResponse(BaseModel):
    """Attendance session details."""
    id: int
    session_name: str
    class_name: str | None = None
    date: date
    start_time: datetime
    end_time: datetime | None = None
    camera_id: str | None = None
    is_active: bool = True
    total_entries: int = 0
    unique_students: int = 0
    notes: str | None = None

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    """List of sessions."""
    sessions: list[SessionResponse]
    total: int


# ── Recognition Response ─────────────────────────────────────────────────

class RecognitionResult(BaseModel):
    """Result of a face recognition attempt."""
    success: bool
    student_id: int | None = None
    student_name: str | None = None
    student_code: str | None = None
    confidence: float = 0.0
    is_live: bool = True
    liveness_score: float = 0.0
    face_quality: str = "good"  # good, low, rejected
    message: str = ""


class RegistrationResult(BaseModel):
    """Result of a face registration attempt."""
    success: bool
    student_id: int | None = None
    is_live: bool = True
    liveness_score: float = 0.0
    face_quality: str = "good"
    message: str = ""
