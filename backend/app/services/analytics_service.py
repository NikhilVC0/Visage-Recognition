"""Analytics service — attendance trends and reports."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceRecord, EventType
from app.models.student import Student


async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Get comprehensive dashboard statistics."""
    from app.services.attendance_service import get_today_stats

    today_stats = await get_today_stats(db)

    # Students with face registered
    face_registered_result = await db.execute(
        select(func.count(Student.id)).where(
            Student.is_active == True,
            Student.face_embedding.isnot(None),
        )
    )
    face_registered = face_registered_result.scalar() or 0

    # Recent activity (last 10 events)
    recent_result = await db.execute(
        select(AttendanceRecord)
        .join(Student)
        .order_by(AttendanceRecord.timestamp.desc())
        .limit(10)
    )
    recent_records = recent_result.scalars().all()

    recent_activity = [
        {
            "id": r.id,
            "student_name": r.student.name if r.student else "Unknown",
            "student_id": r.student.student_id if r.student else "",
            "event_type": r.event_type.value,
            "timestamp": r.timestamp.isoformat(),
            "confidence": r.confidence_score,
        }
        for r in recent_records
    ]

    return {
        **today_stats,
        "face_registered": face_registered,
        "recent_activity": recent_activity,
    }


async def get_attendance_trends(
    db: AsyncSession,
    days: int = 30,
    class_name: str | None = None,
) -> dict:
    """Get attendance trends over a period.

    Returns:
        Dict with daily_data (list of {date, present, total, rate}) and summary.
    """
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days)

    # Get total active students (optionally filtered by class_name)
    total_query = select(func.count(Student.id)).where(Student.is_active == True)
    if class_name:
        total_query = total_query.where(Student.class_name == class_name)
    total_result = await db.execute(total_query)
    total_students = total_result.scalar() or 0

    # Build daily attendance data
    daily_data: list[dict] = []

    for i in range(days + 1):
        current_date = start_date + timedelta(days=i)

        # Count distinct students present on this date
        present_query = select(
            func.count(func.distinct(AttendanceRecord.student_id))
        ).where(func.date(AttendanceRecord.timestamp) == current_date)

        if class_name:
            present_query = present_query.join(Student).where(
                Student.class_name == class_name
            )

        present_result = await db.execute(present_query)
        present = present_result.scalar() or 0

        rate = (present / total_students * 100) if total_students > 0 else 0

        daily_data.append({
            "date": current_date.isoformat(),
            "present": present,
            "total": total_students,
            "rate": round(rate, 1),
        })

    # Calculate summary
    rates = [d["rate"] for d in daily_data if d["present"] > 0]
    avg_rate = sum(rates) / len(rates) if rates else 0

    return {
        "daily_data": daily_data,
        "summary": {
            "period_days": days,
            "total_students": total_students,
            "average_attendance_rate": round(avg_rate, 1),
            "best_day": max(daily_data, key=lambda d: d["rate"]) if daily_data else None,
            "worst_day": min(
                [d for d in daily_data if d["present"] > 0],
                key=lambda d: d["rate"],
                default=None,
            ),
        },
    }


async def get_student_report(db: AsyncSession, student_id: int) -> dict:
    """Get detailed attendance report for a specific student."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        return {"error": "Student not found"}

    # Get all attendance records for this student
    records_result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.student_id == student_id)
        .order_by(AttendanceRecord.timestamp.desc())
    )
    records = records_result.scalars().all()

    # Calculate stats
    today = datetime.now(timezone.utc).date()
    last_30_days = today - timedelta(days=30)

    total_entries = len([r for r in records if r.event_type == EventType.ENTRY])
    unique_days = len(set(r.timestamp.date() for r in records))

    recent_records = [r for r in records if r.timestamp.date() >= last_30_days]
    recent_days = len(set(r.timestamp.date() for r in recent_records))

    return {
        "student": {
            "id": student.id,
            "student_id": student.student_id,
            "name": student.name,
            "class_name": student.class_name,
            "section": student.section,
            "year": student.year,
        },
        "stats": {
            "total_entries": total_entries,
            "unique_days_present": unique_days,
            "days_present_last_30": recent_days,
            "attendance_rate_30d": round(recent_days / 30 * 100, 1),
        },
        "recent_records": [
            {
                "id": r.id,
                "event_type": r.event_type.value,
                "timestamp": r.timestamp.isoformat(),
                "confidence": r.confidence_score,
                "session_id": r.session_id,
            }
            for r in records[:50]  # Last 50 records
        ],
    }


async def get_class_breakdown(db: AsyncSession) -> list[dict]:
    """Get attendance breakdown by class."""
    today = datetime.now(timezone.utc).date()

    result = await db.execute(
        select(Student.class_name, func.count(Student.id))
        .where(Student.is_active == True, Student.class_name.isnot(None))
        .group_by(Student.class_name)
    )
    classes = result.all()

    breakdown = []
    for class_n, total in classes:
        present_result = await db.execute(
            select(func.count(func.distinct(AttendanceRecord.student_id)))
            .join(Student)
            .where(
                Student.class_name == class_n,
                func.date(AttendanceRecord.timestamp) == today,
            )
        )
        present = present_result.scalar() or 0

        breakdown.append({
            "class_name": class_n,
            "total_students": total,
            "present_today": present,
            "attendance_rate": round(present / total * 100, 1) if total > 0 else 0,
        })

    return sorted(breakdown, key=lambda d: d["attendance_rate"], reverse=True)


async def get_top_students(db: AsyncSession, limit: int = 5) -> list[dict]:
    """Get students with the highest attendance rates."""
    days_result = await db.execute(
        select(func.count(func.distinct(func.date(AttendanceRecord.timestamp))))
    )
    total_days = days_result.scalar() or 0
    if total_days == 0:
        total_days = 1

    query = (
        select(
            Student.id,
            Student.student_id,
            Student.name,
            Student.class_name,
            Student.section,
            func.count(func.distinct(func.date(AttendanceRecord.timestamp))).label("attended_days")
        )
        .outerjoin(AttendanceRecord, AttendanceRecord.student_id == Student.id)
        .where(Student.is_active == True)
        .group_by(Student.id)
    )
    result = await db.execute(query)
    rows = result.all()

    students_list = []
    for r in rows:
        rate = (r.attended_days / total_days * 100)
        students_list.append({
            "name": r.name,
            "id": r.student_id,
            "class_name": r.class_name or "Unknown",
            "section": r.section or "Unknown",
            "rate": round(min(rate, 100.0), 1),
        })

    students_list.sort(key=lambda s: s["rate"], reverse=True)
    return students_list[:limit]
