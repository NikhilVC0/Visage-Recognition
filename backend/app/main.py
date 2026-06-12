"""UniFace Core MVP — FastAPI Application Entry Point.

This is the main entry point for the AI-Powered Face Recognition
Attendance System backend. It initialises the FastAPI app, configures
CORS, mounts all routers, and handles startup/shutdown lifecycle events.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request, Response

from app.config import settings
from app.database import AsyncSessionLocal, init_db
from app.routers import auth, students, recognition, attendance, analytics, export, cameras
from app.utils.rate_limit import limiter

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — runs on startup and shutdown."""
    # ── Startup ──────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info("=" * 60)

    # Create upload directories
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.FACE_IMAGES_DIR).mkdir(parents=True, exist_ok=True)

    # Initialise database tables
    logger.info("Initialising database ...")
    await init_db()

    # Seed default admin account
    async with AsyncSessionLocal() as session:
        from app.services.auth_service import seed_default_admin
        await seed_default_admin(session)

    # Load face recognition models
    logger.info("Loading face recognition models ...")
    from app.services.face_engine import face_engine
    await face_engine.load_models()

    # Pre-load embeddings cache
    async with AsyncSessionLocal() as session:
        from app.services.student_service import refresh_embeddings_cache
        await refresh_embeddings_cache(session)

    logger.info("✅ Application startup complete")
    logger.info(f"   API docs: http://localhost:8000/docs")
    logger.info(f"   Frontend: {settings.CORS_ORIGINS[0]}")
    logger.info("=" * 60)

    yield  # App is running

    # ── Shutdown ─────────────────────────────────────────────────────
    logger.info("Shutting down application ...")


# ── Create FastAPI App ───────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-Powered Face Recognition Attendance System using UniFace. "
        "Provides face registration, real-time recognition, attendance logging, "
        "analytics, and export capabilities."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate Limiting ────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda req, exc: Response(
    status_code=429, 
    content='{"detail": "Too Many Requests"}', 
    media_type="application/json"
))
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

# Note: Middlewares are executed in reverse order of declaration in FastAPI.
# CORSMiddleware must be the LAST one added to be the outermost layer.
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers ────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api")
app.include_router(students.router, prefix="/api")
app.include_router(recognition.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(cameras.router, prefix="/api")


# ── Health Check ─────────────────────────────────────────────────────────

@app.get("/api/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    from app.services.face_engine import face_engine
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "face_engine_ready": face_engine.is_ready,
    }


# ── Serve Uploaded Files ─────────────────────────────────────────────────

uploads_path = Path(settings.UPLOAD_DIR)
if uploads_path.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")
