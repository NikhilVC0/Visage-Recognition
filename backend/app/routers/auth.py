"""Authentication API routes."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
)
from app.services import auth_service
from app.utils.security import get_current_user, require_admin
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("30/minute")
async def login(request: Request, credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    user = await auth_service.authenticate_user(db, credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await auth_service.create_token_response(user)


@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(
    data: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Create a new user account (admin only)."""
    try:
        user = await auth_service.create_user(db, data)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Get the currently authenticated user's information."""
    return UserResponse.model_validate(current_user)
