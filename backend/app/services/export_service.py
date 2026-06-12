"""Export service — CSV and PDF report generation."""

import csv
import io
from datetime import date, datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceRecord
from app.models.student import Student


async def export_attendance_csv(
    db: AsyncSession,
    target_date: date | None = None,
    session_id: int | None = None,
    student_id: int | None = None,
) -> str:
    """Export attendance records as CSV string.

    Returns:
        CSV formatted string.
    """
    query = select(AttendanceRecord).join(Student)
    filters = []

    if target_date:
        filters.append(func.date(AttendanceRecord.timestamp) == target_date)
    if session_id:
        filters.append(AttendanceRecord.session_id == session_id)
    if student_id:
        filters.append(AttendanceRecord.student_id == student_id)

    if filters:
        from sqlalchemy import and_
        query = query.where(and_(*filters))

    query = query.order_by(AttendanceRecord.timestamp.desc())
    result = await db.execute(query)
    records = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Record ID", "Student ID", "Student Name", "Class", "Section",
        "Event Type", "Timestamp", "Confidence Score",
        "Manual Override", "Anti-Spoof Checked", "Session ID", "Notes",
    ])

    # Data rows
    for r in records:
        student = r.student
        writer.writerow([
            r.id,
            student.student_id if student else "",
            student.name if student else "",
            student.class_name if student else "",
            student.section if student else "",
            r.event_type.value,
            r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            f"{r.confidence_score:.3f}" if r.confidence_score else "",
            "Yes" if r.is_manual_override else "No",
            "Yes" if r.is_spoofing_checked else "No",
            r.session_id or "",
            (r.notes or "").replace("\n", " "),
        ])

    return output.getvalue()


async def export_attendance_pdf(
    db: AsyncSession,
    target_date: date | None = None,
    session_id: int | None = None,
) -> bytes:
    """Export attendance records as a PDF report.

    Returns:
        PDF file content as bytes.
    """
    query = select(AttendanceRecord).join(Student)
    filters = []

    if target_date:
        filters.append(func.date(AttendanceRecord.timestamp) == target_date)
    if session_id:
        filters.append(AttendanceRecord.session_id == session_id)

    if filters:
        from sqlalchemy import and_
        query = query.where(and_(*filters))

    query = query.order_by(AttendanceRecord.timestamp.desc())
    result = await db.execute(query)
    records = result.scalars().all()

    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=8 * mm,
    )
    date_str = target_date.isoformat() if target_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    elements.append(Paragraph(f"Attendance Report — {date_str}", title_style))

    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=6 * mm,
    )
    elements.append(
        Paragraph(
            f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | "
            f"Total Records: {len(records)}",
            subtitle_style,
        )
    )
    elements.append(Spacer(1, 4 * mm))

    if not records:
        elements.append(Paragraph("No attendance records found for the selected filters.", styles["Normal"]))
    else:
        # Table data
        header = ["#", "Student ID", "Name", "Class", "Section", "Event", "Time", "Confidence", "Override"]
        data = [header]

        for i, r in enumerate(records, 1):
            student = r.student
            data.append([
                str(i),
                student.student_id if student else "",
                student.name if student else "",
                (student.class_name or "")[:20] if student else "",
                (student.section or "")[:20] if student else "",
                r.event_type.value.upper(),
                r.timestamp.strftime("%H:%M:%S"),
                f"{r.confidence_score:.2f}" if r.confidence_score else "-",
                "✓" if r.is_manual_override else "",
            ])

        # Style the table
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            # Header
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            # Body
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ALIGN", (0, 1), (0, -1), "CENTER"),
            ("ALIGN", (4, 1), (4, -1), "CENTER"),
            ("ALIGN", (6, 1), (7, -1), "CENTER"),
            # Alternating rows
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            # Grid
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)

    doc.build(elements)
    return buffer.getvalue()
