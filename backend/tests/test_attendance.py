"""Tests for attendance endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_session(client: AsyncClient, auth_headers: dict):
    """Test creating an attendance session."""
    response = await client.post(
        "/api/attendance/sessions",
        json={
            "session_name": "CS101 - Data Structures - Period 1",
            "class_name": "CS101",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["session_name"] == "CS101 - Data Structures - Period 1"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_end_session(client: AsyncClient, auth_headers: dict):
    """Test ending an active session."""
    # Create session
    create_resp = await client.post(
        "/api/attendance/sessions",
        json={"session_name": "Test Session"},
        headers=auth_headers,
    )
    session_id = create_resp.json()["id"]

    # End session
    response = await client.post(
        f"/api/attendance/sessions/{session_id}/end",
        json={"notes": "Session completed normally"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False
    assert data["end_time"] is not None


@pytest.mark.asyncio
async def test_manual_attendance(client: AsyncClient, auth_headers: dict):
    """Test manually marking attendance."""
    # Create a student first
    student_resp = await client.post(
        "/api/students",
        json={"student_id": "STU-ATT-001", "name": "Attendance Student"},
        headers=auth_headers,
    )
    student_id = student_resp.json()["id"]

    # Mark attendance
    response = await client.post(
        "/api/attendance/mark",
        json={
            "student_id": student_id,
            "event_type": "entry",
            "notes": "Manual check-in",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == student_id
    assert data["event_type"] == "entry"
    assert data["is_manual_override"] is True


@pytest.mark.asyncio
async def test_get_attendance_logs(client: AsyncClient, auth_headers: dict):
    """Test retrieving attendance logs."""
    response = await client.get("/api/attendance/logs", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "records" in data
    assert "total" in data
    assert "page" in data


@pytest.mark.asyncio
async def test_today_stats(client: AsyncClient, auth_headers: dict):
    """Test getting today's attendance statistics."""
    response = await client.get("/api/attendance/today", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_students" in data
    assert "present_today" in data
    assert "attendance_rate" in data


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test the health check endpoint (no auth required)."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
