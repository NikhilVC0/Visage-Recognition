"""Face recognition API routes — registration and identification."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.attendance import RecognitionResult, RegistrationResult
from app.services import student_service
from app.services.face_engine import face_engine
from app.services.attendance_service import mark_attendance
from app.utils.helpers import decode_base64_image
from app.utils.security import get_current_user
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/recognition", tags=["Face Recognition"])


class FaceImageRequest(BaseModel):
    """Request with a base64-encoded face image."""
    image: str = Field(..., max_length=3000000, description="Base64-encoded image (JPEG/PNG)")


class RegisterFaceRequest(BaseModel):
    """Request to register a face for a student."""
    student_id: int = Field(..., description="Database ID of the student")
    images: list[str] = Field(..., description="List of Base64-encoded images (JPEG/PNG)")


class IdentifyRequest(BaseModel):
    """Request to identify a face and optionally mark attendance."""
    image: str = Field(..., max_length=3000000, description="Base64-encoded image (JPEG/PNG)")
    session_id: int | None = Field(None, description="Active session ID for attendance")
    event_type: str = Field(default="entry", pattern="^(entry|exit)$")


@router.post("/register", response_model=RegistrationResult)
async def register_face(
    data: RegisterFaceRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Register a student's face by capturing their embedding from multiple angles.

    Anti-spoofing is performed on all images to ensure the faces are live.
    """
    try:
        images = [decode_base64_image(img) for img in data.images]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required")

    result = await student_service.register_multi_face(db, data.student_id, images)

    return RegistrationResult(
        success=result["success"],
        student_id=data.student_id if result["success"] else None,
        is_live=result.get("is_live", False),
        liveness_score=result.get("liveness_score", 0.0),
        face_quality=result.get("face_quality", "rejected"),
        message=result["message"],
    )


@router.post("/identify", response_model=RecognitionResult)
@limiter.limit("60/minute")
async def identify_face(
    request: Request,
    data: IdentifyRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Identify a face from the database and optionally log attendance.

    Pipeline:
    1. Decode image
    2. Detect faces
    3. Check liveness (anti-spoofing)
    4. Extract embedding
    5. Match against database
    6. If matched and session_id provided, mark attendance
    """
    try:
        image = decode_base64_image(data.image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Ensure embeddings are loaded
    if not face_engine._embeddings_cache:
        await student_service.refresh_embeddings_cache(db)

    # Run full pipeline
    faces = face_engine.process_frame(image)

    if not faces:
        return RecognitionResult(
            success=False,
            message="No face detected in frame",
        )

    # Use the best face (highest confidence)
    face = max(faces, key=lambda f: f.confidence)

    if face.quality == "rejected":
        return RecognitionResult(
            success=False,
            face_quality="rejected",
            message="Face quality too low — move closer or improve lighting",
        )

    if not face.is_live:
        return RecognitionResult(
            success=False,
            is_live=False,
            liveness_score=face.liveness_score,
            message="Liveness check failed — possible spoofing detected",
        )

    if face.embedding is None:
        return RecognitionResult(
            success=False,
            message="Failed to extract face features",
        )

    # Match against database
    match = face_engine.match_embedding(face.embedding)

    if not match.matched:
        return RecognitionResult(
            success=False,
            confidence=match.similarity,
            is_live=face.is_live,
            liveness_score=face.liveness_score,
            face_quality=face.quality,
            message=f"Face not recognised (best similarity: {match.similarity:.2f})",
        )

    # Mark attendance if session is active
    if data.session_id:
        await mark_attendance(
            db,
            student_db_id=match.student_db_id,
            event_type=data.event_type,
            session_id=data.session_id,
            confidence=match.similarity,
            is_manual=False,
            is_spoof_checked=True,
        )

    return RecognitionResult(
        success=True,
        student_id=match.student_db_id,
        student_name=match.student_name,
        student_code=match.student_id,
        confidence=match.similarity,
        is_live=face.is_live,
        liveness_score=face.liveness_score,
        face_quality=face.quality,
        message=f"Recognised: {match.student_name} ({match.similarity:.2f} confidence)",
    )


@router.post("/verify-liveness")
@limiter.limit("60/minute")
async def verify_liveness(
    request: Request,
    data: FaceImageRequest,
    _user=Depends(get_current_user),
):
    """Standalone liveness/anti-spoofing check on a face image."""
    try:
        image = decode_base64_image(data.image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    faces = face_engine.detect_faces(image)
    if not faces:
        return {"is_live": False, "score": 0.0, "message": "No face detected"}

    face = faces[0]
    is_live, score = face_engine.check_liveness(image, face)

    return {
        "is_live": is_live,
        "score": score,
        "message": "Live face detected" if is_live else "Spoofing detected",
    }


@router.post("/analyze_frame")
async def analyze_frame(
    data: FaceImageRequest,
    _user=Depends(get_current_user),
):
    """Analyze a single frame for face presence, liveness, and head pose (yaw, pitch, roll)."""
    if not face_engine.is_ready:
        # Still provide analysis in demo mode, but flag it
        pass

    try:
        image = decode_base64_image(data.image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    faces = face_engine.detect_faces(image)
    if not faces:
        return {
            "face_detected": False,
            "message": "No face detected",
            "engine_ready": face_engine.is_ready,
        }

    # Use the largest/most confident face
    face = max(faces, key=lambda f: f.confidence)

    # Cast bbox to native python types
    bbox_list = [int(x) for x in face.bbox]

    # Calculate face dimensions for debugging
    face_w = bbox_list[2] - bbox_list[0]
    face_h = bbox_list[3] - bbox_list[1]

    if face.quality == "rejected":
        return {
            "face_detected": True,
            "quality": "rejected",
            "message": f"Face too small ({face_w}x{face_h}px). Move closer to the camera.",
            "face_size": {"width": face_w, "height": face_h},
            "engine_ready": face_engine.is_ready,
        }

    # Extract liveness and pose
    is_live, liveness_score = face_engine.check_liveness(image, face)
    yaw, pitch, roll = face_engine.extract_head_pose(image, face)

    return {
        "face_detected": True,
        "quality": face.quality,
        "is_live": bool(is_live),
        "liveness_score": float(liveness_score),
        "pose": {
            "yaw": float(yaw),
            "pitch": float(pitch),
            "roll": float(roll),
        },
        "bbox": bbox_list,
        "face_size": {"width": face_w, "height": face_h},
        "engine_ready": face_engine.is_ready,
        "head_pose_available": not (yaw == 0.0 and pitch == 0.0 and roll == 0.0),
    }


@router.get("/status")
async def engine_status():
    """Check if the face recognition engine is ready."""
    return {
        "ready": face_engine.is_ready,
        "cached_embeddings": len(face_engine._embeddings_cache),
        "detection_threshold": face_engine._detector is not None,
        "recognition_available": face_engine._recogniser is not None,
        "anti_spoof_available": face_engine._anti_spoof is not None,
    }
