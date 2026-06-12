import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test the health check endpoint."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app" in data
    assert "version" in data
    assert "face_engine_ready" in data
