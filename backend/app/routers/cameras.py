"""Camera management API routes."""

import base64

import cv2
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.camera_manager import (
    camera_manager,
    create_camera,
    delete_camera,
    get_camera_by_id,
    get_cameras,
    test_camera_connection,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/cameras", tags=["Camera Sources"])


# ── Request/Response Schemas ─────────────────────────────────────────────

class CameraCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    source_url: str = Field(..., min_length=1, max_length=500)
    camera_type: str = Field(default="webcam", pattern="^(webcam|rtsp|http|onvif)$")
    role: str = Field(default="entry", pattern="^(entry|exit|both)$")
    location: str | None = Field(None, max_length=200)
    fps: float = Field(default=1.0, ge=0.1, le=30.0)
    notes: str | None = None


class CameraResponse(BaseModel):
    id: int
    name: str
    source_url: str
    camera_type: str
    role: str
    location: str | None = None
    is_active: bool = True
    is_monitoring: bool = False
    fps: float = 1.0
    notes: str | None = None
    stream_status: dict | None = None

    model_config = {"from_attributes": True}


class CameraTestRequest(BaseModel):
    source_url: str = Field(..., min_length=1)
    camera_type: str = Field(default="webcam", pattern="^(webcam|rtsp|http|onvif)$")


# ── Endpoints ────────────────────────────────────────────────────────────

@router.get("", response_model=list[CameraResponse])
async def list_cameras(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List all configured camera sources."""
    cameras = await get_cameras(db, active_only=active_only)
    statuses = camera_manager.get_all_statuses()

    return [
        CameraResponse(
            id=c.id,
            name=c.name,
            source_url=c.source_url,
            camera_type=c.camera_type,
            role=c.role,
            location=c.location,
            is_active=c.is_active,
            is_monitoring=c.is_monitoring,
            fps=c.fps,
            notes=c.notes,
            stream_status=statuses.get(c.id),
        )
        for c in cameras
    ]


@router.post("", response_model=CameraResponse, status_code=201)
async def add_camera(
    data: CameraCreateRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Add a new camera source."""
    camera = await create_camera(
        db,
        name=data.name,
        source_url=data.source_url,
        camera_type=data.camera_type,
        role=data.role,
        location=data.location,
        fps=data.fps,
        notes=data.notes,
    )
    return CameraResponse(
        id=camera.id,
        name=camera.name,
        source_url=camera.source_url,
        camera_type=camera.camera_type,
        role=camera.role,
        location=camera.location,
        is_active=camera.is_active,
        is_monitoring=camera.is_monitoring,
        fps=camera.fps,
        notes=camera.notes,
    )


@router.delete("/{camera_id}", status_code=204)
async def remove_camera(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Remove a camera source."""
    success = await delete_camera(db, camera_id)
    if not success:
        raise HTTPException(status_code=404, detail="Camera not found")


@router.patch("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Partially update a camera (e.g., toggle active)."""
    camera = await get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    if "is_active" in data:
        camera.is_active = data["is_active"]
    
    await db.flush()
    await db.refresh(camera)
    
    statuses = camera_manager.get_all_statuses()
    return CameraResponse(
        id=camera.id,
        name=camera.name,
        source_url=camera.source_url,
        camera_type=camera.camera_type,
        role=camera.role,
        location=camera.location,
        is_active=camera.is_active,
        is_monitoring=camera.is_monitoring,
        fps=camera.fps,
        notes=camera.notes,
        stream_status=statuses.get(camera.id)
    )

@router.post("/test")
async def test_camera(
    data: CameraTestRequest,
    _user=Depends(get_current_user),
):
    """Test a camera connection without saving it."""
    result = await test_camera_connection(data.source_url, data.camera_type)
    return result


@router.get("/{camera_id}/snapshot")
async def get_snapshot(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get a single snapshot frame from a camera."""
    camera = await get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    stream = camera_manager.get_stream(camera_id)
    if not stream:
        # Create temporary stream
        stream = camera_manager.add_stream(
            camera_id, camera.source_url, camera.camera_type
        )

    frame = stream.grab_frame()
    if frame is None:
        raise HTTPException(status_code=503, detail="Could not capture frame from camera")

    # Encode as JPEG base64
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "image": f"data:image/jpeg;base64,{b64}",
        "resolution": f"{frame.shape[1]}x{frame.shape[0]}",
        "camera_id": camera_id,
    }


@router.post("/{camera_id}/start-monitoring")
async def start_monitoring(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Start continuous monitoring on a camera for face recognition."""
    camera = await get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    stream = camera_manager.get_stream(camera_id)
    if not stream:
        stream = camera_manager.add_stream(
            camera_id, camera.source_url, camera.camera_type
        )

    if not stream.connect():
        raise HTTPException(status_code=503, detail=f"Cannot connect to camera: {stream._error}")

    stream.start_continuous(fps=camera.fps)
    camera.is_monitoring = True
    await db.flush()

    return {"message": f"Monitoring started for {camera.name}", "camera_id": camera_id}


@router.post("/{camera_id}/stop-monitoring")
async def stop_monitoring(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Stop monitoring a camera."""
    camera = await get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    stream = camera_manager.get_stream(camera_id)
    if stream:
        stream.stop_continuous()

    camera.is_monitoring = False
    await db.flush()

    return {"message": f"Monitoring stopped for {camera.name}", "camera_id": camera_id}
