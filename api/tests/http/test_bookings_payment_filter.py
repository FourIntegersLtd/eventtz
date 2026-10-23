"""The booking lists filter by a set of payment statuses on the server, so pages and totals add up."""

from __future__ import annotations

from collections import Counter

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.settings import get_settings
from app.features.bookings import service_queries
from tests.http.test_bookings_maintenance import _make_booking, _make_parties

pytestmark = [pytest.mark.db, pytest.mark.e2e]

# Eleven bookings across every payment status; more than any page used below.
_SEEDED = (
    ["paid"] * 3
    + ["payout_released"] * 2
    + ["refunded"] * 2
    + ["partially_refunded"]
    + ["unpaid"] * 2
    + ["pending"]
)


async def _seed(session: AsyncSession, prefix: str) -> tuple[str, str]:
    """A client and vendor with one booking per entry of `_SEEDED`; returns (client id, vendor id)."""
    client_id, vendor_id = await _make_parties(session, prefix)
    for index, payment_status in enumerate(_SEEDED):
        await _make_booking(
            session,
            client_id=client_id,
            vendor_id=vendor_id,
            payment_status=payment_status,
            event_date=f"2020-06-{index + 1:02d}",
        )
    return client_id, vendor_id


def _bearer(user_id: str, email: str) -> dict[str, str]:
    """An Authorization header for an existing account."""
    token = issue_access_token(user_id=user_id, email=email, settings=get_settings())
    return {"Authorization": f"Bearer {token}"}


async def test_client_list_filters_by_several_payment_statuses_with_true_totals(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """`payment_status=paid,payout_released` pages through exactly those rows; total counts all of them."""
    client_id, _vendor_id = await _seed(db_session, "pf-client")
    headers = _bearer(client_id, "pf-client-client@example.com")
    seen: list[str] = []
    for offset in (0, 2, 4):
        response = await client.get(
            "/api/v1/client/booking-requests",
            params={"group": "all", "payment_status": "paid,payout_released", "offset": offset, "limit": 2},
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 5
        seen.extend(item["payment_status"] for item in body["bookings"])
    assert Counter(seen) == {"paid": 3, "payout_released": 2}


async def test_client_list_single_payment_status_and_exclude_still_work(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The original single-value `payment_status` and `exclude_payment_status` behave as before."""
    client_id, _vendor_id = await _seed(db_session, "pf-single")
    headers = _bearer(client_id, "pf-single-client@example.com")
    refunded = await client.get(
        "/api/v1/client/booking-requests",
        params={"group": "all", "payment_status": "refunded"},
        headers=headers,
    )
    assert refunded.json()["total"] == 2
    history = await client.get(
        "/api/v1/client/booking-requests",
        params={"group": "all", "exclude_payment_status": "unpaid", "limit": 3},
        headers=headers,
    )
    assert history.json()["total"] == 9
    assert len(history.json()["bookings"]) == 3


async def test_unknown_payment_status_is_a_stable_error(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A value outside the payment lifecycle is refused with a stable code, never an empty page."""
    client_id, _vendor_id = await _seed(db_session, "pf-bad")
    response = await client.get(
        "/api/v1/client/booking-requests",
        params={"group": "all", "payment_status": "paid,bogus"},
        headers=_bearer(client_id, "pf-bad-client@example.com"),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "booking_invalid_payment_status"


async def test_vendor_list_filters_by_several_payment_statuses(db_session: AsyncSession) -> None:
    """The vendor list takes the same set, with a total over all pages."""
    _client_id, vendor_id = await _seed(db_session, "pf-vendor")
    items, total = await service_queries.vendor_bookings_page(
        db_session,
        vendor_id,
        group="all",
        status=None,
        payment_status="refunded, partially_refunded",
        exclude_payment_status=None,
        search=None,
        offset=2,
        limit=2,
    )
    assert total == 3
    assert len(items) == 1
    assert items[0].payment_status in {"refunded", "partially_refunded"}
