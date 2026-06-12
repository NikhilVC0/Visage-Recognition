"""Analytics API routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import analytics_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get comprehensive dashboard statistics including recent activity."""
    return await analytics_service.get_dashboard_stats(db)


@router.get("/attendance-trends")
async def get_attendance_trends(
    days: int = Query(30, ge=1, le=365),
    class_name: str | None = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get daily attendance trends over a specified period."""
    return await analytics_service.get_attendance_trends(
        db, days=days, class_name=class_name
    )


@router.get("/student/{student_id}/report")
async def get_student_report(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get a detailed attendance report for a specific student."""
    report = await analytics_service.get_student_report(db, student_id)
    if "error" in report:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=report["error"])
    return report


@router.get("/classes")
async def get_class_breakdown(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get attendance breakdown by class for today."""
    return await analytics_service.get_class_breakdown(db)


@router.get("/top-students")
async def get_top_students(
    limit: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get the top attending students."""
    return await analytics_service.get_top_students(db, limit=limit)
