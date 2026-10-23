"""The admin creator-links list reports how many partners are active across all pages."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = [pytest.mark.db, pytest.mark.e2e]


async def test_partner_list_counts_active_partners_beyond_the_page(
    client: AsyncClient, make_actor: Any
) -> None:
    """`active_total` counts switched-on partners over the whole list, so a one-row page still reports all."""
    staff_token = await make_actor("active-partners-staff@example.com", user_type="admin", admin_role="admin")
    headers = {"Authorization": f"Bearer {staff_token}"}
    url = "/api/v1/admin/referrals/partners"

    empty = await client.get(url, headers=headers)
    assert empty.status_code == 200, empty.text
    assert (empty.json()["total"], empty.json()["active_total"]) == (0, 0)

    created = []
    for name in ("Alpha", "Bravo", "Charlie"):
        response = await client.post(url, headers=headers, json={"display_name": name})
        assert response.status_code in (200, 201), response.text
        created.append(response.json()["partner"]["id"])
    switched_off = await client.patch(f"{url}/{created[0]}", headers=headers, json={"is_active": False})
    assert switched_off.status_code == 200, switched_off.text

    first_page = await client.get(url, headers=headers, params={"limit": 1})
    assert first_page.json()["total"] == 3
    assert len(first_page.json()["partners"]) == 1
    assert first_page.json()["active_total"] == 2
