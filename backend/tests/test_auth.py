"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, auth_headers: dict):
    """Test successful login returns a JWT token."""
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, auth_headers: dict):
    """Test login with wrong password returns 401."""
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient, auth_headers: dict):
    """Test login with non-existent user returns 401."""
    response = await client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "password"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient, auth_headers: dict):
    """Test getting current user info with valid token."""
    response = await client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_protected_route_no_token(client: AsyncClient, auth_headers: dict):
    """Test that protected routes require authentication."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
