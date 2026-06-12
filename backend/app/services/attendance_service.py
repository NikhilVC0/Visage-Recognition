"""Attendance tracking service."""

from datetime import date, datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceRecord, AttendanceSession, EventType
from app.models.student import Student
from app.schemas.attendance import (
    AttendanceLogResponse,
    AttendanceOverrideRequest,
    AttendanceRecordResponse,
    SessionCreateRequest,
    SessionListResponse,
    SessionResponse,
)
from app.utils.helpers import calculate_pagination
from app.services.email_service import send_attendance_email


# ── Session Management ───────────────────────────────────────────────────

async def create_session(
    db: AsyncSession, data: SessionCreateRequest
) -> AttendanceSession:
    """Create a new attendance session."""
    session = AttendanceSession(
        session_name=data.session_name,
        class_name=data.class_name,
        camera_id=data.camera_id,
        notes=data.notes,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def end_session(
    db: AsyncSession, session_id: int, notes: str | None = None
) -> AttendanceSession | None:
    """End an active session."""
    result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None

    session.is_active = False
    session.end_time = datetime.now(timezone.utc)
    if notes:
        session.notes = (session.notes or "") + f"\n{notes}"
    await db.flush()
    await db.refresh(session)
    return session


async def get_sessions(
    db: AsyncSession,
    active_only: bool = False,
    target_date: date | None = None,
) -> SessionListResponse:
    """List attendance sessions with counts."""
    query = select(AttendanceSession)

    if active_only:
        query = query.where(AttendanceSession.is_active == True)

    if target_date:
        query = query.where(AttendanceSession.date == target_date)

    query = query.order_by(AttendanceSession.start_time.desc())
    result = await db.execute(query)
    sessions = result.scalars().all()

    responses: list[SessionResponse] = []
    for s in sessions:
        # Count records for this session
        count_result = await db.execute(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.session_id == s.id
            )
        )
        total_entries = count_result.scalar() or 0

        unique_result = await db.execute(
            select(func.count(func.distinct(AttendanceRecord.student_id))).where(
                AttendanceRecord.session_id == s.id
            )
        )
        unique_students = unique_result.scalar() or 0

        responses.append(
            SessionResponse(
                id=s.id,
                session_name=s.session_name,
                class_name=s.class_name,
                date=s.date,
                start_time=s.start_time,
                end_time=s.end_time,
                camera_id=s.camera_id,
                is_active=s.is_active,
                total_entries=total_entries,
                unique_students=unique_students,
                notes=s.notes,
            )
        )

    return SessionListResponse(sessions=responses, total=len(responses))


# ── Attendance Recording ─────────────────────────────────────────────────

async def mark_attendance(
    db: AsyncSession,
    student_db_id: int,
    event_type: str = "entry",
    session_id: int | None = None,
    confidence: float | None = None,
    is_manual: bool = False,
    is_spoof_checked: bool = True,
    notes: str | None = None,
) -> AttendanceRecord:
    """Record an attendance event for a student."""
    record = AttendanceRecord(
        student_id=student_db_id,
        session_id=session_id,
        event_type=EventType(event_type),
        confidence_score=confidence,
        is_manual_override=is_manual,
        is_spoofing_checked=is_spoof_checked,
        notes=notes,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    # Fetch student to send email alert
    student_result = await db.execute(select(Student).where(Student.id == student_db_id))
    student = student_result.scalar_one_or_none()
    if student and student.email:
        time_str = record.timestamp.strftime("%Y-%m-%d %I:%M %p UTC")
        await send_attendance_email(student.name, student.email, event_type, time_str)

    return record


async def get_attendance_logs(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    student_id: int | None = None,
    session_id: int | None = None,
    target_date: date | None = None,
    event_type: str | None = None,
) -> AttendanceLogResponse:
    """Get attendance logs with filtering and pagination."""
    query = select(AttendanceRecord).join(Student)
    count_query = select(func.count(AttendanceRecord.id)).join(Student)

    filters = []
    if student_id:
        filters.append(AttendanceRecord.student_id == student_id)
    if session_id:
        filters.append(AttendanceRecord.session_id == session_id)
    if target_date:
        filters.append(func.date(AttendanceRecord.timestamp) == target_date)
    if event_type:
        filters.append(AttendanceRecord.event_type == EventType(event_type))

    if filters:
        combined = and_(*filters)
        query = query.where(combined)
        count_query = count_query.where(combined)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    pag = calculate_pagination(total, page, page_size)

    query = (
        query
        .order_by(AttendanceRecord.timestamp.desc())
        .offset(pag["offset"])
        .limit(page_size)
    )
    result = await db.execute(query)
    records = result.scalars().all()

    responses = []
    for r in records:
        student = r.student
        responses.append(
            AttendanceRecordResponse(
                id=r.id,
                student_id=r.student_id,
                student_name=student.name if student else "",
                student_student_id=student.student_id if student else "",
                session_id=r.session_id,
                event_type=r.event_type.value,
                timestamp=r.timestamp,
                confidence_score=r.confidence_score,
                is_manual_override=r.is_manual_override,
                is_spoofing_checked=r.is_spoofing_checked,
                notes=r.notes,
            )
        )

    return AttendanceLogResponse(
        records=responses,
        total=pag["total"],
        page=pag["page"],
        page_size=pag["page_size"],
        total_pages=pag["total_pages"],
    )


async def override_attendance(
    db: AsyncSession,
    record_id: int,
    data: AttendanceOverrideRequest,
) -> AttendanceRecord | None:
    """Override an existing attendance record."""
    result = await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        return None

    if data.event_type:
        record.event_type = EventType(data.event_type)
    record.is_manual_override = True
    record.notes = (record.notes or "") + f"\n[Override] {data.notes}"
    await db.flush()
    await db.refresh(record)
    return record


# ── Today's Stats ────────────────────────────────────────────────────────

async def get_today_stats(db: AsyncSession) -> dict:
    """Get attendance statistics for today."""
    today = datetime.now(timezone.utc).date()

    # Total students
    total_students_result = await db.execute(
        select(func.count(Student.id)).where(Student.is_active == True)
    )
    total_students = total_students_result.scalar() or 0

    # Students present today (distinct)
    present_result = await db.execute(
        select(func.count(func.distinct(AttendanceRecord.student_id))).where(
            func.date(AttendanceRecord.timestamp) == today
        )
    )
    present_today = present_result.scalar() or 0

    # Active sessions
    active_sessions_result = await db.execute(
        select(func.count(AttendanceSession.id)).where(
            AttendanceSession.is_active == True
        )
    )
    active_sessions = active_sessions_result.scalar() or 0

    # Total events today
    events_result = await db.execute(
        select(func.count(AttendanceRecord.id)).where(
            func.date(AttendanceRecord.timestamp) == today
        )
    )
    total_events = events_result.scalar() or 0

    # Attendance rate
    attendance_rate = (present_today / total_students * 100) if total_students > 0 else 0

    return {
        "total_students": total_students,
        "present_today": present_today,
        "absent_today": total_students - present_today,
        "attendance_rate": round(attendance_rate, 1),
        "active_sessions": active_sessions,
        "total_events_today": total_events,
        "date": today.isoformat(),
    }
