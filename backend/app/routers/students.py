"""Student management API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.student import (
    StudentCreateRequest,
    StudentListResponse,
    StudentResponse,
    StudentUpdateRequest,
)
from app.services import student_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=StudentListResponse)
async def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    class_name: str | None = Query(None, max_length=100),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List all students with optional search and filtering."""
    return await student_service.get_students(
        db, page=page, page_size=page_size,
        search=search, class_name=class_name, active_only=active_only,
    )


@router.get("/classes", response_model=list[str])
async def list_classes(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get all unique class names."""
    return await student_service.get_all_classes(db)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get a single student by database ID."""
    student = await student_service.get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentResponse.from_orm_with_face(student)


@router.post("", response_model=StudentResponse, status_code=201)
async def create_student(
    data: StudentCreateRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Create a new student record."""
    try:
        student = await student_service.create_student(db, data)
        return StudentResponse.from_orm_with_face(student)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: int,
    data: StudentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Update a student's information."""
    student = await student_service.update_student(db, student_id, data)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentResponse.from_orm_with_face(student)


@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Soft-delete a student (deactivate)."""
    success = await student_service.delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
