"""General helper utilities."""

import base64
import math
from datetime import date, datetime, timezone

import cv2
import numpy as np


def decode_base64_image(base64_string: str) -> np.ndarray:
    """Decode a base64-encoded image string into an OpenCV BGR numpy array.

    Supports both raw base64 and data-URI format (e.g., 'data:image/jpeg;base64,...').

    Args:
        base64_string: Base64 string, optionally with data-URI prefix.

    Returns:
        OpenCV image as numpy array (BGR format).

    Raises:
        ValueError: If the image cannot be decoded.
    """
    # Strip data-URI prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(base64_string)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image — invalid format")
        return img
    except Exception as e:
        raise ValueError(f"Invalid base64 image: {e}")


def encode_image_to_base64(image: np.ndarray, fmt: str = ".jpg") -> str:
    """Encode an OpenCV image to a base64 string.

    Args:
        image: OpenCV image (BGR numpy array).
        fmt: Image format extension (e.g., '.jpg', '.png').

    Returns:
        Base64-encoded string (without data-URI prefix).
    """
    _, buffer = cv2.imencode(fmt, image)
    return base64.b64encode(buffer).decode("utf-8")


def calculate_pagination(total: int, page: int, page_size: int) -> dict:
    """Calculate pagination metadata.

    Returns:
        Dict with total, page, page_size, total_pages, offset.
    """
    total_pages = max(1, math.ceil(total / page_size))
    page = max(1, min(page, total_pages))
    offset = (page - 1) * page_size

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "offset": offset,
    }


def format_datetime(dt: datetime | None) -> str:
    """Format a datetime object for display."""
    if dt is None:
        return "N/A"
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def today_utc() -> date:
    """Get today's date in UTC."""
    return datetime.now(timezone.utc).date()
