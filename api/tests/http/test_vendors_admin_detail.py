"""Staff open one vendor's admin page: `GET /admin/vendors/{user_id}`, over HTTP.

The page used to be a popup fed by the list; this route lets it load on its own URL
in the same shape as a list row.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import repository as identity_repository
from app.features.vendors import repository as vendors_repository
from tests.conftest import MakeActor

pytestmark = [pytest.mark.db, pytest.mark.e2e]

UNKNOWN_VENDOR_ID = "00000000-0000-4000-8000-000000000000"


def _vendor_url(vendor_user_id: str) -> str:
    """The staff path for one vendor."""
    return f"/api/v1/admin/vendors/{vendor_user_id}"


def _bearer(token: str) -> dict[str, str]:
    """Authorization header for a token."""
    return {"Authorization": f"Bearer {token}"}


async def _vendor(session: AsyncSession) -> str:
    """A verified vendor account with a profile; returns its id."""
    vendor_id = await identity_repository.create_account(
        session,
        email="detail-vendor@example.com",
        user_type="vendor",
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert vendor_id is not None
    saved = await vendors_repository.save_profile(
        session, vendor_id, {"payload": {"businessName": "Detail Test Photography"}}, exists=False
    )
    assert saved
    return vendor_id


async def test_vendor_detail_requires_sign_in(client: AsyncClient) -> None:
    """No session: 401."""
    response = await client.get(_vendor_url(UNKNOWN_VENDOR_ID))
    assert (response.status_code, response.json()["code"]) == (401, "unauthenticated")


async def test_vendor_detail_is_forbidden_for_a_client(client: AsyncClient, make_actor: MakeActor) -> None:
    """A client is stopped by the staff gate."""
    token = await make_actor("detail-gate-client@example.com")
    response = await client.get(_vendor_url(UNKNOWN_VENDOR_ID), headers=_bearer(token))
    assert (response.status_code, response.json()["code"]) == (403, "wrong_portal")


@pytest.mark.parametrize("vendor_id", [UNKNOWN_VENDOR_ID, "not-a-uuid"])
async def test_vendor_detail_for_an_unknown_vendor_is_a_404(
    client: AsyncClient, make_actor: MakeActor, vendor_id: str
) -> None:
    """No vendor row for the id (or a malformed id): the staff routes' not-found.

    One request per test: the 404 rolls back the shared test session, actor included.
    """
    token = await make_actor("detail-admin-404@example.com", user_type="admin", admin_role="admin")
    response = await client.get(_vendor_url(vendor_id), headers=_bearer(token))
    assert response.status_code == 404
    assert response.json() == {"detail": "Vendor profile not found", "code": "vendor_profile_not_found"}


async def test_vendor_detail_returns_the_list_row(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession
) -> None:
    """Staff get the vendor in the list's row shape, email and private cancellation count included."""
    vendor_id = await _vendor(db_session)
    token = await make_actor("detail-admin@example.com", user_type="admin", admin_role="admin")
    response = await client.get(_vendor_url(vendor_id), headers=_bearer(token))
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    vendor = body["vendor"]
    assert vendor["user_id"] == vendor_id
    assert vendor["email"] == "detail-vendor@example.com"
    assert vendor["profile_form_data"]["businessName"] == "Detail Test Photography"
    assert vendor["approval_status"] == "pending"
    assert vendor["vendor_cancellation_count"] == 0
    assert vendor["cancellation_review_flag"] is False
