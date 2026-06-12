"""Shared test fixtures and configuration."""

import asyncio
import os
import sys
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure the backend app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import Base, get_db
from app.main import app


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    """Test database session dependency override."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Override the DB dependency for all tests
app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database for each test function."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def auth_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Get auth headers by creating and logging in as an admin user."""
    from app.services.auth_service import seed_default_admin
    await seed_default_admin(db_session)
    await db_session.commit()

    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
