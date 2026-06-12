"""Application configuration via environment variables."""

import os
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=os.path.join(Path(__file__).resolve().parent.parent, ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "Visage Core MVP"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./visage_attendance.db"

    # ── Authentication ───────────────────────────────────────────────────
    SECRET_KEY: str = "visage-mvp-secret-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # ── Face Recognition ─────────────────────────────────────────────────
    # Device execution provider: auto, cpu, or gpu
    FACE_MODEL_DEVICE: str = "auto"
    # Cosine similarity threshold for face matching (higher = stricter)
    FACE_MATCH_THRESHOLD: float = 0.50
    # Minimum detection confidence to accept a face
    FACE_DETECTION_CONFIDENCE: float = 0.5
    # Anti-spoofing threshold (higher = stricter liveness check)
    ANTI_SPOOF_THRESHOLD: float = 0.35  # Lowered for 720p webcams
    # Minimum face size in pixels (width) for quality validation
    MIN_FACE_SIZE: int = 50

    # ── Storage ──────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    FACE_IMAGES_DIR: str = "./uploads/faces"

    # ── CORS ─────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # ── Default Admin ────────────────────────────────────────────────────
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"
    DEFAULT_ADMIN_EMAIL: str = "admin@visage.local"

    @model_validator(mode='after')
    def validate_production_security(self) -> 'Settings':
        if not self.DEBUG:
            if self.SECRET_KEY == "visage-mvp-secret-change-in-production-2026":
                raise ValueError("Insecure default SECRET_KEY cannot be used in production (DEBUG=False).")
            if self.DEFAULT_ADMIN_PASSWORD == "admin123":
                raise ValueError("Insecure DEFAULT_ADMIN_PASSWORD cannot be used in production (DEBUG=False).")
        
        # Handle CORS_ORIGINS as CSV string if passed from .env
        if isinstance(self.CORS_ORIGINS, str):
            self.CORS_ORIGINS = [x.strip() for x in self.CORS_ORIGINS.split(',')]
            
        return self


settings = Settings()
