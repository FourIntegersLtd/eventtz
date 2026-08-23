"""Smoke tests for the FastAPI application."""

from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_head():
    """UptimeRobot HTTP(s) monitors send HEAD (same as OSCE Guide Flask)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.head("/health")
    assert response.status_code == 200
