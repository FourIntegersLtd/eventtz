"""List endpoints expose offset, limit and total alongside their row arrays."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from app.core.pagination import DEFAULT_LIST_LIMIT

pytestmark = [pytest.mark.db, pytest.mark.e2e]


async def test_list_endpoints_default_limit(client: AsyncClient, make_actor: Any) -> None:
    staff_token = await make_actor(
        "pagination-default-limit@example.com", user_type="admin", admin_role="admin"
    )
    response = await client.get(
        "/api/v1/admin/team",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == DEFAULT_LIST_LIMIT


async def test_admin_team_list_pagination_fields(client: AsyncClient, make_actor: Any) -> None:
    staff_token = await make_actor("pagination-team-staff@example.com", user_type="admin", admin_role="admin")
    response = await client.get(
        "/api/v1/admin/team",
        headers={"Authorization": f"Bearer {staff_token}"},
        params={"offset": 0, "limit": 50},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["offset"] == 0
    assert body["limit"] == 50
    assert isinstance(body["total"], int)
    assert len(body["members"]) <= 50


async def test_admin_financials_daily_list_pagination_fields(client: AsyncClient, make_actor: Any) -> None:
    staff_token = await make_actor(
        "pagination-financials-staff@example.com", user_type="admin", admin_role="admin"
    )
    response = await client.get(
        "/api/v1/admin/financials/daily",
        headers={"Authorization": f"Bearer {staff_token}"},
        params={"offset": 0, "limit": 50},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["offset"] == 0
    assert body["limit"] == 50
    assert isinstance(body["total"], int)
    assert len(body["daily"]) <= 50


async def test_admin_disputes_list_pagination_fields(client: AsyncClient, make_actor: Any) -> None:
    staff_token = await make_actor(
        "pagination-disputes-staff@example.com", user_type="admin", admin_role="admin"
    )
    response = await client.get(
        "/api/v1/admin/disputes",
        headers={"Authorization": f"Bearer {staff_token}"},
        params={"status": "all", "offset": 0, "limit": 10},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["offset"] == 0
    assert body["limit"] == 10
    assert isinstance(body["total"], int)
    assert len(body["disputes"]) <= 10


async def test_client_disputes_list_pagination_fields(client: AsyncClient, make_actor: Any) -> None:
    client_token = await make_actor("pagination-disputes-client@example.com", user_type="client")
    response = await client.get(
        "/api/v1/client/disputes",
        headers={"Authorization": f"Bearer {client_token}"},
        params={"offset": 0, "limit": 50},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["offset"] == 0
    assert body["limit"] == 50
    assert isinstance(body["total"], int)
    assert len(body["disputes"]) <= 50
    assert isinstance(body.get("open_count"), int)


async def test_vendor_disputes_open_count_field(client: AsyncClient, make_actor: Any) -> None:
    vendor_token = await make_actor("pagination-disputes-vendor@example.com", user_type="vendor")
    response = await client.get(
        "/api/v1/vendor/disputes",
        headers={"Authorization": f"Bearer {vendor_token}"},
        params={"offset": 0, "limit": 50},
    )
    assert response.status_code == 200
    assert isinstance(response.json().get("open_count"), int)


async def test_chat_conversations_list_pagination_fields(client: AsyncClient, make_actor: Any) -> None:
    client_token = await make_actor("pagination-chat-client@example.com", user_type="client")
    response = await client.get(
        "/api/v1/chat/conversations",
        headers={"Authorization": f"Bearer {client_token}"},
        params={"offset": 0, "limit": 50, "kind": "dm"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["offset"] == 0
    assert body["limit"] == 50
    assert isinstance(body["total"], int)
    assert len(body["conversations"]) <= 50


async def test_vendor_reviews_list_pagination_fields(client: AsyncClient, make_actor: Any) -> None:
    vendor_token = await make_actor("pagination-reviews-vendor@example.com", user_type="vendor")
    response = await client.get(
        "/api/v1/vendor/reviews",
        headers={"Authorization": f"Bearer {vendor_token}"},
        params={"offset": 0, "limit": 50, "min_rating": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["offset"] == 0
    assert body["limit"] == 50
    assert isinstance(body["total"], int)
    assert isinstance(body.get("five_star_count"), int)
    assert len(body["reviews"]) <= 50


async def test_client_notifications_feed_read_state_total(client: AsyncClient, make_actor: Any) -> None:
    client_token = await make_actor("pagination-feed-client@example.com", user_type="client")
    response = await client.get(
        "/api/v1/client/notifications/feed",
        headers={"Authorization": f"Bearer {client_token}"},
        params={"offset": 0, "limit": 5, "read_state": "unread"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == 5
    assert isinstance(body["total"], int)
    assert len(body["items"]) <= 5


async def test_team_pages_hold_exactly_limit_rows_and_never_overlap(
    client: AsyncClient, make_actor: Any
) -> None:
    """Seed limit+1 rows: page one is full, page two holds the single remainder, none repeat."""
    token = await make_actor("page-exact-0@example.com", user_type="admin", admin_role="admin")
    for index in range(1, 3):
        await make_actor(f"page-exact-{index}@example.com", user_type="admin", admin_role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    first = (await client.get("/api/v1/admin/team", headers=headers, params={"limit": 2})).json()
    later = {"limit": 2, "offset": 2}
    second = (await client.get("/api/v1/admin/team", headers=headers, params=later)).json()
    assert (first["total"], first["offset"], first["limit"], len(first["members"])) == (3, 0, 2, 2)
    assert (second["total"], second["offset"], second["limit"], len(second["members"])) == (3, 2, 2, 1)
    seen = [member["user_id"] for member in first["members"] + second["members"]]
    assert len(set(seen)) == 3


async def test_a_limit_above_the_maximum_is_rejected(client: AsyncClient, make_actor: Any) -> None:
    """The shared cap answers 422 instead of returning an unbounded page."""
    token = await make_actor("page-max@example.com", user_type="admin", admin_role="admin")
    response = await client.get(
        "/api/v1/admin/team", headers={"Authorization": f"Bearer {token}"}, params={"limit": 100000}
    )
    assert response.status_code == 422


async def test_client_dashboard_endpoint(client: AsyncClient, make_actor: Any) -> None:
    client_token = await make_actor("pagination-dashboard-client@example.com", user_type="client")
    response = await client.get(
        "/api/v1/client/dashboard",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["active_count"], int)
    assert isinstance(body["upcoming_agenda"], list)


async def test_vendor_dashboard_endpoint(client: AsyncClient, make_actor: Any) -> None:
    vendor_token = await make_actor("pagination-dashboard-vendor@example.com", user_type="vendor")
    response = await client.get(
        "/api/v1/vendor/dashboard",
        headers={"Authorization": f"Bearer {vendor_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["pending_bookings_count"], int)
    assert isinstance(body["needs_response"], list)
