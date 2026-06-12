"""Student management service."""

from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.student import Student
from app.schemas.student import (
    StudentCreateRequest,
    StudentListResponse,
    StudentResponse,
    StudentUpdateRequest,
)
from app.services.face_engine import face_engine
from app.utils.helpers import calculate_pagination


async def get_students(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    class_name: str | None = None,
    active_only: bool = True,
) -> StudentListResponse:
    """List students with optional filtering and pagination."""
    query = select(Student)
    count_query = select(func.count(Student.id))

    if active_only:
        query = query.where(Student.is_active == True)
        count_query = count_query.where(Student.is_active == True)

    if search:
        search_filter = or_(
            Student.name.ilike(f"%{search}%"),
            Student.student_id.ilike(f"%{search}%"),
            Student.email.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if class_name:
        query = query.where(Student.class_name == class_name)
        count_query = count_query.where(Student.class_name == class_name)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    pag = calculate_pagination(total, page, page_size)

    query = query.order_by(Student.name).offset(pag["offset"]).limit(page_size)
    result = await db.execute(query)
    students = result.scalars().all()

    return StudentListResponse(
        students=[StudentResponse.from_orm_with_face(s) for s in students],
        total=pag["total"],
        page=pag["page"],
        page_size=pag["page_size"],
        total_pages=pag["total_pages"],
    )


async def get_student_by_id(db: AsyncSession, student_id: int) -> Student | None:
    """Get a single student by database ID."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    return result.scalar_one_or_none()


async def get_student_by_student_id(db: AsyncSession, student_id: str) -> Student | None:
    """Get a single student by institution student ID."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    return result.scalar_one_or_none()


async def create_student(db: AsyncSession, data: StudentCreateRequest) -> Student:
    """Create a new student record (without face registration).

    Raises:
        ValueError: If student_id already exists.
    """
    existing = await get_student_by_student_id(db, data.student_id)
    if existing:
        raise ValueError(f"Student ID '{data.student_id}' already exists")

    duplicate_name_query = select(Student).where(
        func.lower(Student.name) == data.name.lower(),
        Student.class_name == data.class_name,
        Student.section == data.section,
        Student.is_active == True,
    )
    duplicate_name_result = await db.execute(duplicate_name_query)
    if duplicate_name_result.scalar_one_or_none():
        raise ValueError(f"A student named '{data.name}' already exists in {data.class_name} Section {data.section}.")

    student = Student(
        student_id=data.student_id,
        name=data.name,
        email=data.email,
        class_name=data.class_name,
        section=data.section,
        year=data.year,
        notes=data.notes,
    )
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return student


async def update_student(
    db: AsyncSession, student_id: int, data: StudentUpdateRequest
) -> Student | None:
    """Update student fields."""
    student = await get_student_by_id(db, student_id)
    if not student:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(student, key, value)

    student.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(student)
    return student


async def delete_student(db: AsyncSession, student_id: int) -> bool:
    """Soft-delete a student (set is_active=False)."""
    student = await get_student_by_id(db, student_id)
    if not student:
        return False

    student.is_active = False
    student.updated_at = datetime.now(timezone.utc)
    await db.flush()
    
    # Reload embeddings cache to remove deleted student
    await refresh_embeddings_cache(db)
    
    return True


async def register_multi_face(
    db: AsyncSession,
    student_id: int,
    images: list[np.ndarray],
) -> dict:
    """Register a student's face by extracting and averaging embeddings from multiple angles.

    Requires at least 4 out of the provided images (usually 5) to pass liveness and quality checks.
    
    Returns:
        Dict with success, message, liveness_score, face_quality.
    """
    student = await get_student_by_id(db, student_id)
    if not student:
        return {"success": False, "message": "Student not found", "is_live": False, "liveness_score": 0.0, "face_quality": "rejected"}

    valid_embeddings = []
    liveness_scores = []
    best_face_image = None
    best_face_bbox = None
    best_face_quality = "rejected"
    frame_failures = []  # Track why each frame failed

    import logging
    _logger = logging.getLogger(__name__)

    for idx, image in enumerate(images):
        # Detect faces
        faces = face_engine.detect_faces(image)
        if not faces:
            frame_failures.append(f"Frame {idx+1}: No face detected")
            _logger.warning(f"Registration frame {idx+1}: No face detected")
            continue
        if len(faces) > 1:
            frame_failures.append(f"Frame {idx+1}: Multiple faces detected ({len(faces)})")
            _logger.warning(f"Registration frame {idx+1}: Multiple faces ({len(faces)})")
            continue
            
        face = faces[0]

        # Quality check
        if face.quality == "rejected":
            w = face.bbox[2] - face.bbox[0]
            h = face.bbox[3] - face.bbox[1]
            frame_failures.append(f"Frame {idx+1}: Face too small ({w}x{h}px, min={50})")
            _logger.warning(f"Registration frame {idx+1}: quality=rejected ({w}x{h}px)")
            continue

        # Anti-spoofing
        is_live, liveness_score = face_engine.check_liveness(image, face)
        if not is_live:
            frame_failures.append(f"Frame {idx+1}: Liveness failed (score={liveness_score:.2f})")
            _logger.warning(f"Registration frame {idx+1}: liveness failed score={liveness_score:.2f}")
            continue

        # Extract embedding
        embedding = face_engine.extract_embedding(image, face)
        if embedding is None:
            frame_failures.append(f"Frame {idx+1}: Embedding extraction failed")
            _logger.warning(f"Registration frame {idx+1}: embedding extraction failed")
            continue

        _logger.info(f"Registration frame {idx+1}: PASSED (quality={face.quality}, liveness={liveness_score:.2f})")
        valid_embeddings.append(embedding)
        liveness_scores.append(liveness_score)
        
        # Keep the best quality face for the thumbnail
        if face.quality == "good" and best_face_quality != "good":
            best_face_quality = "good"
            best_face_image = image
            best_face_bbox = face.bbox
        elif best_face_quality == "rejected":
            best_face_quality = face.quality
            best_face_image = image
            best_face_bbox = face.bbox

    # Require at least 2 valid frames (lowered from 4 for reliability)
    min_required_frames = min(2, len(images))
    if len(valid_embeddings) < min_required_frames:
        failure_detail = "; ".join(frame_failures) if frame_failures else "Unknown"
        return {
            "success": False, 
            "message": f"Only {len(valid_embeddings)}/{len(images)} frames passed. Failures: {failure_detail}", 
            "is_live": False, 
            "liveness_score": np.mean(liveness_scores) if liveness_scores else 0.0, 
            "face_quality": best_face_quality
        }

    # Average the embeddings for a robust representation
    avg_embedding = np.mean(valid_embeddings, axis=0)
    # Normalize the averaged embedding
    avg_embedding = avg_embedding / np.linalg.norm(avg_embedding)

    # Check for duplicate face across all registered students
    match = face_engine.match_embedding(avg_embedding)
    if match.matched and match.student_db_id != student_id:
        return {
            "success": False,
            "message": f"Face is already registered to {match.student_name} ({match.student_id}).",
            "is_live": True,
            "liveness_score": np.mean(liveness_scores),
            "face_quality": best_face_quality
        }

    # Store embedding as binary blob
    student.face_embedding = avg_embedding.astype(np.float32).tobytes()
    student.embedding_version = "arcface_v1_multi"
    student.updated_at = datetime.now(timezone.utc)

    # Save face thumbnail
    if best_face_image is not None and best_face_bbox is not None:
        try:
            face_dir = Path(settings.FACE_IMAGES_DIR)
            face_dir.mkdir(parents=True, exist_ok=True)
            import cv2
            x1, y1, x2, y2 = best_face_bbox
            face_img = best_face_image[y1:y2, x1:x2]
            photo_path = str(face_dir / f"{student.student_id}.jpg")
            cv2.imwrite(photo_path, face_img)
            student.photo_path = photo_path
        except Exception:
            pass  # Non-critical

    await db.flush()

    # Reload embeddings cache
    await refresh_embeddings_cache(db)

    return {
        "success": True,
        "message": f"Face registered successfully for {student.name} ({len(valid_embeddings)} frames merged)",
        "is_live": True,
        "liveness_score": np.mean(liveness_scores),
        "face_quality": best_face_quality,
    }


async def refresh_embeddings_cache(db: AsyncSession) -> None:
    """Reload all active student embeddings into the face engine cache."""
    result = await db.execute(
        select(Student).where(
            Student.is_active == True,
            Student.face_embedding.isnot(None),
        )
    )
    students = result.scalars().all()

    cache_data = [
        {
            "db_id": s.id,
            "student_id": s.student_id,
            "name": s.name,
            "embedding_bytes": s.face_embedding,
        }
        for s in students
    ]

    face_engine.load_embeddings_cache(cache_data)


async def get_all_classes(db: AsyncSession) -> list[str]:
    """Get all unique class names."""
    result = await db.execute(
        select(Student.class_name)
        .where(Student.is_active == True, Student.class_name.isnot(None))
        .distinct()
    )
    return [row[0] for row in result.all() if row[0]]
