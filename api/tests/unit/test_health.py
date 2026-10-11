"""`GET /health` is Railway's deploy gate and the uptime monitor's probe: no sign-in, no database."""

from __future__ import annotations

from httpx import ASGITransport, AsyncClient

from app.main import create_app


async def test_health_answers_ok_without_a_session_or_database() -> None:
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_answers_head_for_the_uptime_monitor() -> None:
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        response = await client.head("/health")
    assert response.status_code == 200
