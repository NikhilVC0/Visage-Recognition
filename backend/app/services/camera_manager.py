"""Camera management service — handles multiple camera sources.

Supports:
  - Local webcams (USB, built-in)
  - RTSP streams (CCTV, IP cameras)
  - HTTP/MJPEG streams (phone cameras, e.g. IP Webcam app)
  - ONVIF cameras
"""

from __future__ import annotations

import logging
import threading
import time

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.camera import CameraSource, CameraType

logger = logging.getLogger(__name__)


class CameraStream:
    """Manages a single camera stream (runs in a background thread)."""

    def __init__(self, source_url: str, camera_type: str, camera_id: int):
        self.source_url = source_url
        self.camera_type = camera_type
        self.camera_id = camera_id
        self._cap: cv2.VideoCapture | None = None
        self._last_frame: np.ndarray | None = None
        self._last_frame_time: float = 0
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self._connected = False
        self._error: str | None = None
        self._fps: float = 0.0

    def _get_capture_source(self) -> int | str:
        """Convert source URL to OpenCV capture source."""
        if self.camera_type == CameraType.WEBCAM.value:
            try:
                return int(self.source_url)
            except ValueError:
                return 0
        return self.source_url

    def connect(self) -> bool:
        """Open the camera connection."""
        try:
            source = self._get_capture_source()
            self._cap = cv2.VideoCapture(source)

            if self.camera_type == CameraType.RTSP.value:
                # Optimise for RTSP streams
                self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not self._cap.isOpened():
                self._error = f"Failed to open camera: {self.source_url}"
                self._connected = False
                logger.error(self._error)
                return False

            self._connected = True
            self._error = None
            logger.info(f"Camera {self.camera_id} connected: {self.source_url}")
            return True

        except Exception as e:
            self._error = str(e)
            self._connected = False
            logger.error(f"Camera {self.camera_id} connection error: {e}")
            return False

    def disconnect(self):
        """Close the camera connection."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        if self._cap:
            self._cap.release()
            self._cap = None
        self._connected = False
        logger.info(f"Camera {self.camera_id} disconnected")

    def grab_frame(self) -> np.ndarray | None:
        """Grab a single frame from the camera."""
        if not self._cap or not self._cap.isOpened():
            if not self.connect():
                return None

        ret, frame = self._cap.read()
        if not ret or frame is None:
            self._connected = False
            return None

        with self._lock:
            self._last_frame = frame.copy()
            self._last_frame_time = time.time()

        return frame

    def start_continuous(self, fps: float = 1.0):
        """Start continuous frame capture in background thread."""
        if self._running:
            return

        self._running = True
        interval = 1.0 / max(fps, 0.1)

        def _capture_loop():
            while self._running:
                self.grab_frame()
                time.sleep(interval)

        self._thread = threading.Thread(target=_capture_loop, daemon=True)
        self._thread.start()
        logger.info(f"Camera {self.camera_id}: continuous capture started at {fps} fps")

    def stop_continuous(self):
        """Stop continuous frame capture."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info(f"Camera {self.camera_id}: continuous capture stopped")

    def get_latest_frame(self) -> np.ndarray | None:
        """Get the most recent frame (thread-safe)."""
        with self._lock:
            return self._last_frame.copy() if self._last_frame is not None else None

    @property
    def status(self) -> dict:
        """Camera status info."""
        return {
            "connected": self._connected,
            "running": self._running,
            "error": self._error,
            "last_frame_age": time.time() - self._last_frame_time if self._last_frame_time > 0 else None,
            "fps": self._fps,
        }


class CameraManager:
    """Manages all camera sources for the application."""

    _instance: CameraManager | None = None

    def __new__(cls) -> CameraManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._streams = {}
        return cls._instance

    def get_stream(self, camera_id: int) -> CameraStream | None:
        """Get an active camera stream by ID."""
        return self._streams.get(camera_id)

    def add_stream(self, camera_id: int, source_url: str, camera_type: str) -> CameraStream:
        """Add and connect a new camera stream."""
        if camera_id in self._streams:
            self._streams[camera_id].disconnect()

        stream = CameraStream(source_url, camera_type, camera_id)
        self._streams[camera_id] = stream
        return stream

    def remove_stream(self, camera_id: int):
        """Remove and disconnect a camera stream."""
        if camera_id in self._streams:
            self._streams[camera_id].disconnect()
            del self._streams[camera_id]

    def get_all_statuses(self) -> dict[int, dict]:
        """Get status of all camera streams."""
        return {cid: stream.status for cid, stream in self._streams.items()}

    def shutdown_all(self):
        """Disconnect all cameras."""
        for stream in self._streams.values():
            stream.disconnect()
        self._streams.clear()


# Module-level singleton
camera_manager = CameraManager()


# ── Database Operations ──────────────────────────────────────────────────

async def get_cameras(db: AsyncSession, active_only: bool = True) -> list[CameraSource]:
    """Get all camera sources."""
    query = select(CameraSource)
    if active_only:
        query = query.where(CameraSource.is_active == True)
    query = query.order_by(CameraSource.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_camera_by_id(db: AsyncSession, camera_id: int) -> CameraSource | None:
    """Get a single camera source by ID."""
    result = await db.execute(
        select(CameraSource).where(CameraSource.id == camera_id)
    )
    return result.scalar_one_or_none()


async def create_camera(
    db: AsyncSession,
    name: str,
    source_url: str,
    camera_type: str = "webcam",
    role: str = "entry",
    location: str | None = None,
    fps: float = 1.0,
    notes: str | None = None,
) -> CameraSource:
    """Create a new camera source."""
    camera = CameraSource(
        name=name,
        source_url=source_url,
        camera_type=camera_type,
        role=role,
        location=location,
        fps=fps,
        notes=notes,
    )
    db.add(camera)
    await db.flush()
    await db.refresh(camera)
    return camera


async def delete_camera(db: AsyncSession, camera_id: int) -> bool:
    """Delete a camera source."""
    camera = await get_camera_by_id(db, camera_id)
    if not camera:
        return False

    # Stop stream if active
    camera_manager.remove_stream(camera_id)

    camera.is_active = False
    await db.flush()
    return True


async def test_camera_connection(source_url: str, camera_type: str) -> dict:
    """Test if a camera source can be connected."""
    stream = CameraStream(source_url, camera_type, camera_id=-1)
    try:
        connected = stream.connect()
        frame = stream.grab_frame() if connected else None
        has_frame = frame is not None
        frame_shape = frame.shape if has_frame else None
        return {
            "success": connected and has_frame,
            "connected": connected,
            "has_frame": has_frame,
            "resolution": f"{frame_shape[1]}x{frame_shape[0]}" if frame_shape else None,
            "error": stream._error,
        }
    finally:
        stream.disconnect()
