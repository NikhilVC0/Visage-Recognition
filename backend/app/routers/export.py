"""Export API routes — CSV and PDF download endpoints."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import export_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/csv")
async def export_csv(
    target_date: date | None = Query(None),
    session_id: int | None = Query(None),
    student_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Export attendance records as a downloadable CSV file."""
    csv_content = await export_service.export_attendance_csv(
        db, target_date=target_date, session_id=session_id, student_id=student_id
    )

    date_str = target_date.isoformat() if target_date else "all"
    filename = f"attendance_{date_str}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pdf")
async def export_pdf(
    target_date: date | None = Query(None),
    session_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Export attendance records as a downloadable PDF report."""
    pdf_bytes = await export_service.export_attendance_pdf(
        db, target_date=target_date, session_id=session_id
    )

    date_str = target_date.isoformat() if target_date else "all"
    filename = f"attendance_report_{date_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
