"""Camera source ORM model for multi-camera support."""

from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CameraType(str, PyEnum):
    """Supported camera source types."""
    WEBCAM = "webcam"
    RTSP = "rtsp"
    HTTP = "http"
    ONVIF = "onvif"

class CameraRole(str, PyEnum):
    """Directional role of the camera."""
    ENTRY = "entry"
    EXIT = "exit"
    BOTH = "both"


class CameraSource(Base):
    """Configured camera source for attendance monitoring."""

    __tablename__ = "camera_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Human-readable camera name (e.g., 'Room 101 CCTV')",
    )
    source_url: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Camera source URL (e.g., rtsp://..., http://..., or '0' for local webcam)",
    )
    camera_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=CameraType.WEBCAM.value,
        comment="Camera type: webcam, rtsp, http, onvif",
    )
    location: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
        comment="Physical location (e.g., 'Building A, Room 101')",
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default=CameraRole.ENTRY.value,
        comment="Camera direction/role: entry, exit, or both",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_monitoring: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="Whether this camera is currently being used for active recognition",
    )
    fps: Mapped[float] = mapped_column(
        Float, default=1.0, nullable=False,
        comment="Frames per second to capture for recognition (lower = less CPU)",
    )
    last_seen: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Last time a frame was successfully captured from this camera",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<CameraSource(id={self.id}, name='{self.name}', "
            f"type='{self.camera_type}', role='{self.role}', active={self.is_active})>"
        )
