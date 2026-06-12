"""Attendance management API routes."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.attendance import (
    AttendanceLogResponse,
    AttendanceMarkRequest,
    AttendanceOverrideRequest,
    AttendanceRecordResponse,
    SessionCreateRequest,
    SessionEndRequest,
    SessionListResponse,
    SessionResponse,
)
from app.services import attendance_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/attendance", tags=["Attendance"])


# ── Session Endpoints ────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    data: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Create a new attendance session (class period)."""
    session = await attendance_service.create_session(db, data)
    return SessionResponse.model_validate(session)


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    active_only: bool = Query(False),
    target_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List all attendance sessions."""
    return await attendance_service.get_sessions(db, active_only=active_only, target_date=target_date)


@router.post("/sessions/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: int,
    data: SessionEndRequest | None = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """End an active attendance session."""
    session = await attendance_service.end_session(
        db, session_id, notes=data.notes if data else None
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse.model_validate(session)


# ── Attendance Record Endpoints ──────────────────────────────────────────

@router.post("/mark", response_model=AttendanceRecordResponse)
async def mark_attendance(
    data: AttendanceMarkRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Manually mark attendance for a student."""
    record = await attendance_service.mark_attendance(
        db,
        student_db_id=data.student_id,
        event_type=data.event_type,
        session_id=data.session_id,
        is_manual=True,
        notes=data.notes,
    )
    # Build response with student info
    from app.services.student_service import get_student_by_id
    student = await get_student_by_id(db, data.student_id)

    return AttendanceRecordResponse(
        id=record.id,
        student_id=record.student_id,
        student_name=student.name if student else "",
        student_student_id=student.student_id if student else "",
        session_id=record.session_id,
        event_type=record.event_type.value,
        timestamp=record.timestamp,
        confidence_score=record.confidence_score,
        is_manual_override=record.is_manual_override,
        is_spoofing_checked=record.is_spoofing_checked,
        notes=record.notes,
    )


@router.get("/logs", response_model=AttendanceLogResponse)
async def get_attendance_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    student_id: int | None = Query(None),
    session_id: int | None = Query(None),
    target_date: date | None = Query(None),
    event_type: str | None = Query(None, pattern="^(entry|exit)$"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get attendance logs with optional filtering and pagination."""
    return await attendance_service.get_attendance_logs(
        db, page=page, page_size=page_size,
        student_id=student_id, session_id=session_id,
        target_date=target_date, event_type=event_type,
    )


@router.put("/{record_id}/override", response_model=AttendanceRecordResponse)
async def override_attendance(
    record_id: int,
    data: AttendanceOverrideRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Override an existing attendance record."""
    record = await attendance_service.override_attendance(db, record_id, data)
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    from app.services.student_service import get_student_by_id
    student = await get_student_by_id(db, record.student_id)

    return AttendanceRecordResponse(
        id=record.id,
        student_id=record.student_id,
        student_name=student.name if student else "",
        student_student_id=student.student_id if student else "",
        session_id=record.session_id,
        event_type=record.event_type.value,
        timestamp=record.timestamp,
        confidence_score=record.confidence_score,
        is_manual_override=record.is_manual_override,
        is_spoofing_checked=record.is_spoofing_checked,
        notes=record.notes,
    )


@router.get("/today")
async def get_today_stats(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get today's attendance statistics summary."""
    return await attendance_service.get_today_stats(db)
