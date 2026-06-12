"""Authentication service — login, registration, token management."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, UserCreateRequest, TokenResponse, UserResponse
from app.utils.security import (
    create_access_token,
    hash_password,
    verify_password,
)


async def authenticate_user(
    db: AsyncSession, credentials: LoginRequest
) -> User | None:
    """Validate credentials and return the user if valid."""
    result = await db.execute(
        select(User).where(User.username == credentials.username)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(credentials.password, user.hashed_password):
        return None

    if not user.is_active:
        return None

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    return user


async def create_token_response(user: User) -> TokenResponse:
    """Create a JWT token response for an authenticated user."""
    token = create_access_token(
        data={"sub": user.username, "role": user.role.value}
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


async def create_user(
    db: AsyncSession, data: UserCreateRequest
) -> User:
    """Create a new admin or teacher user.

    Raises:
        ValueError: If username or email already exists.
    """
    # Check uniqueness
    existing = await db.execute(
        select(User).where(
            (User.username == data.username) | (User.email == data.email)
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Username or email already exists")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole(data.role),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def seed_default_admin(db: AsyncSession) -> None:
    """Create the default admin account if it doesn't exist."""
    result = await db.execute(
        select(User).where(User.username == settings.DEFAULT_ADMIN_USERNAME)
    )
    if result.scalar_one_or_none():
        return

    admin = User(
        username=settings.DEFAULT_ADMIN_USERNAME,
        email=settings.DEFAULT_ADMIN_EMAIL,
        hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
        full_name="System Administrator",
        role=UserRole.ADMIN,
    )
    db.add(admin)
    await db.commit()
    print(f"✅ Default admin account created: {settings.DEFAULT_ADMIN_USERNAME}")
