"""Tests for student management endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_student(client: AsyncClient, auth_headers: dict):
    """Test creating a new student."""
    response = await client.post(
        "/api/students",
        json={
            "student_id": "STU-001",
            "name": "Alice Johnson",
            "email": "alice@example.com",
            "class_name": "Computer Science",
            "section": "A",
            "year": 2026,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["student_id"] == "STU-001"
    assert data["name"] == "Alice Johnson"
    assert data["class_name"] == "Computer Science"
    assert data["section"] == "A"
    assert data["has_face_registered"] is False


@pytest.mark.asyncio
async def test_create_duplicate_student(client: AsyncClient, auth_headers: dict):
    """Test that duplicate student IDs are rejected."""
    # Create first student
    await client.post(
        "/api/students",
        json={"student_id": "STU-DUP", "name": "First Student"},
        headers=auth_headers,
    )
    # Try to create duplicate
    response = await client.post(
        "/api/students",
        json={"student_id": "STU-DUP", "name": "Second Student"},
        headers=auth_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_students(client: AsyncClient, auth_headers: dict):
    """Test listing students with pagination."""
    # Create a few students
    for i in range(3):
        await client.post(
            "/api/students",
            json={"student_id": f"STU-LIST-{i}", "name": f"Student {i}"},
            headers=auth_headers,
        )

    response = await client.get("/api/students", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 3
    assert len(data["students"]) >= 3


@pytest.mark.asyncio
async def test_search_students(client: AsyncClient, auth_headers: dict):
    """Test searching students by name."""
    await client.post(
        "/api/students",
        json={"student_id": "STU-SEARCH", "name": "Unique SearchName"},
        headers=auth_headers,
    )

    response = await client.get(
        "/api/students?search=SearchName",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("SearchName" in s["name"] for s in data["students"])


@pytest.mark.asyncio
async def test_update_student(client: AsyncClient, auth_headers: dict):
    """Test updating student information."""
    # Create student
    create_resp = await client.post(
        "/api/students",
        json={"student_id": "STU-UPD", "name": "Original Name"},
        headers=auth_headers,
    )
    student_id = create_resp.json()["id"]

    # Update
    response = await client.put(
        f"/api/students/{student_id}",
        json={"name": "Updated Name", "class_name": "Physics", "section": "B"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["class_name"] == "Physics"
    assert data["section"] == "B"


@pytest.mark.asyncio
async def test_delete_student(client: AsyncClient, auth_headers: dict):
    """Test soft-deleting a student."""
    # Create student
    create_resp = await client.post(
        "/api/students",
        json={"student_id": "STU-DEL", "name": "To Delete"},
        headers=auth_headers,
    )
    student_id = create_resp.json()["id"]

    # Delete
    response = await client.delete(
        f"/api/students/{student_id}", headers=auth_headers
    )
    assert response.status_code == 204

    # Verify not in active list
    list_resp = await client.get("/api/students", headers=auth_headers)
    students = list_resp.json()["students"]
    assert not any(s["id"] == student_id for s in students)
