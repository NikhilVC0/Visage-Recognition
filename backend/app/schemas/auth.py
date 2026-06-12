"""Authentication and user Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel, Field


# ── Request Schemas ──────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Login credentials."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=128)


class UserCreateRequest(BaseModel):
    """Create a new admin or teacher account."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    email: str = Field(..., max_length=255)
    full_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="teacher", pattern="^(admin|teacher)$")


# ── Response Schemas ─────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class UserResponse(BaseModel):
    """Public user information."""
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: datetime | None = None

    model_config = {"from_attributes": True}
