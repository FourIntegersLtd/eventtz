"""The admin bookings console and financials screen, end to end over HTTP.

Covers the 7 routes `router_admin.py` owns: list, detail, the payment-fields
patch, checkout reset, support hold, the financials summary and its CSV
export. Literal values (messages, codes, CSV header) mirror
`acceptance/test_payments.py`'s admin sections, the frozen spec for this
console.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository as bookings_repository

pytestmark = [pytest.mark.db, pytest.mark.e2e]

MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
SUPER_ADMIN_ONLY = "Only super admins can perform this action."


_next_event_date = date(2099, 6, 1)


async def _booking(
    db_session: AsyncSession,
    *,
    client_user_id: str,
    vendor_user_id: str,
    status: str = "accepted",
    payment_status: str = "unpaid",
    **extra: Any,
) -> str:
    """A minimal `booking_requests` row priced at a flat GBP 150.

    Each call advances the event date by a day: the daily-capacity trigger
    (migration 033) refuses a second open booking for the same vendor on the
    same day, and several tests seed more than one for one vendor.
    """
    global _next_event_date  # noqa: PLW0603 - a private test-only counter, not shared state
    event_date = _next_event_date
    _next_event_date += timedelta(days=1)
    row = await bookings_repository.insert_booking(
        db_session,
        {
            "client_user_id": client_user_id,
            "vendor_user_id": vendor_user_id,
            "event_name": "Admin console test",
            "event_date": event_date,
            "status": status,
            "payment_status": payment_status,
            "total_label": "GBP 150",
            "line_items": [{"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}],
            **extra,
        },
    )
    return row.id


@pytest.fixture
async def parties(make_actor: Any) -> tuple[str, str]:
    """One client and one vendor account to seed bookings for."""
    client_token = await make_actor("admin-console-client@example.com", user_type="client")
    vendor_token = await make_actor("admin-console-vendor@example.com", user_type="vendor")
    return client_token, vendor_token


async def _ids_from_tokens(client_token: str, vendor_token: str, client: AsyncClient) -> tuple[str, str]:
    """The `users.id` each token belongs to, read back through `/auth/me`."""
    client_me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {client_token}"})
    vendor_me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {vendor_token}"})
    return client_me.json()["user"]["id"], vendor_me.json()["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    """A Bearer header for `token`."""
    return {"Authorization": f"Bearer {token}"}


# --- list -------------------------------------------------------------------------------


async def test_list_bookings_requires_sign_in(client: AsyncClient) -> None:
    response = await client.get("/api/v1/admin/bookings")
    assert response.status_code == 401


async def test_list_bookings_is_forbidden_for_a_vendor(client: AsyncClient, make_actor: Any) -> None:
    token = await make_actor("admin-list-vendor@example.com", user_type="vendor")
    response = await client.get("/api/v1/admin/bookings", headers=_auth(token))
    assert (response.status_code, response.json()["detail"]) == (403, ADMIN_PORTAL_FORBIDDEN)


async def test_list_bookings_filters_by_status_and_search(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    staff_token = await make_actor("admin-list-staff@example.com", user_type="admin", admin_role="admin")
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    matching_id = await _booking(
        db_session,
        client_user_id=client_id,
        vendor_user_id=vendor_id,
        status="pending",
        event_name="match-me",
    )
    await _booking(
        db_session,
        client_user_id=client_id,
        vendor_user_id=vendor_id,
        status="accepted",
        event_name="skip-me",
    )
    response = await client.get(
        "/api/v1/admin/bookings",
        params={"status": "pending", "search": "match-me"},
        headers=_auth(staff_token),
    )
    assert response.status_code == 200
    body = response.json()
    assert {row["id"] for row in body["bookings"]} == {matching_id}
    assert body["total"] == 1


# --- detail -----------------------------------------------------------------------------


async def test_get_booking_detail_not_found_for_missing_id(client: AsyncClient, make_actor: Any) -> None:
    staff_token = await make_actor("admin-detail-staff@example.com", user_type="admin", admin_role="admin")
    response = await client.get(f"/api/v1/admin/bookings/{MISSING_BOOKING_ID}", headers=_auth(staff_token))
    assert (response.status_code, response.json()["detail"]) == (404, "Booking not found")


async def test_get_booking_detail_writes_a_view_audit_log_row(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    staff_token = await make_actor("admin-view-staff@example.com", user_type="admin", admin_role="admin")
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(
        db_session, client_user_id=client_id, vendor_user_id=vendor_id, status="pending"
    )
    response = await client.get(f"/api/v1/admin/bookings/{booking_id}", headers=_auth(staff_token))
    assert response.status_code == 200
    assert response.json()["booking"]["id"] == booking_id

    from sqlalchemy import text  # noqa: PLC0415 - only this assertion reads the audit table directly

    audit = await db_session.execute(
        text("select action from admin_audit_log where action = 'booking.view' and entity_id = :booking_id"),
        {"booking_id": booking_id},
    )
    assert audit.first() is not None


# --- payment-fields patch ----------------------------------------------------------------


async def test_patch_payment_fields_requires_super_admin(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    staff_token = await make_actor("admin-patch-staff@example.com", user_type="admin", admin_role="admin")
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(db_session, client_user_id=client_id, vendor_user_id=vendor_id)
    response = await client.patch(
        f"/api/v1/admin/bookings/{booking_id}/payment-fields",
        json={"stripe_charge_id": "ch_x"},
        headers=_auth(staff_token),
    )
    assert (response.status_code, response.json()["detail"]) == (403, SUPER_ADMIN_ONLY)


async def test_patch_payment_fields_with_no_body_fields_is_400(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    super_admin_token = await make_actor(
        "admin-patch-empty-super@example.com", user_type="admin", admin_role="super_admin"
    )
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(db_session, client_user_id=client_id, vendor_user_id=vendor_id)
    response = await client.patch(
        f"/api/v1/admin/bookings/{booking_id}/payment-fields", json={}, headers=_auth(super_admin_token)
    )
    assert (response.status_code, response.json()["detail"]) == (400, "No fields to update")


async def test_patch_payment_fields_amount_without_a_payment_intent_is_400(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    super_admin_token = await make_actor(
        "admin-patch-noamt-super@example.com", user_type="admin", admin_role="super_admin"
    )
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(db_session, client_user_id=client_id, vendor_user_id=vendor_id)
    response = await client.patch(
        f"/api/v1/admin/bookings/{booking_id}/payment-fields",
        json={"payment_amount_gbp": 10.0},
        headers=_auth(super_admin_token),
    )
    assert (response.status_code, response.json()["detail"]) == (
        400,
        "stripe_payment_intent_id is required to set payment_amount_gbp.",
    )


# --- reset checkout -----------------------------------------------------------------------


async def test_reset_checkout_requires_super_admin(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    staff_token = await make_actor("admin-reset-staff@example.com", user_type="admin", admin_role="admin")
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(db_session, client_user_id=client_id, vendor_user_id=vendor_id)
    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/reset-checkout", headers=_auth(staff_token)
    )
    assert (response.status_code, response.json()["detail"]) == (403, SUPER_ADMIN_ONLY)


async def test_reset_checkout_rejects_an_already_paid_booking(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    super_admin_token = await make_actor(
        "admin-reset-paid-super@example.com", user_type="admin", admin_role="super_admin"
    )
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(
        db_session,
        client_user_id=client_id,
        vendor_user_id=vendor_id,
        status="accepted",
        payment_status="paid",
    )
    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/reset-checkout", headers=_auth(super_admin_token)
    )
    assert (response.status_code, response.json()["detail"]) == (
        400,
        "Only unpaid or pending checkout bookings can be reset.",
    )


async def test_reset_checkout_clears_a_stale_session_and_returns_to_unpaid(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    super_admin_token = await make_actor(
        "admin-reset-ok-super@example.com", user_type="admin", admin_role="super_admin"
    )
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(
        db_session,
        client_user_id=client_id,
        vendor_user_id=vendor_id,
        status="accepted",
        payment_status="pending",
        stripe_checkout_session_id="cs_test_http",
    )
    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/reset-checkout", headers=_auth(super_admin_token)
    )
    assert response.status_code == 200
    booking = response.json()["booking"]
    assert booking["payment_status"] == "unpaid"
    assert booking["stripe_checkout_session_id"] is None


# --- support hold -------------------------------------------------------------------------


async def test_support_hold_requires_super_admin(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    staff_token = await make_actor("admin-hold-staff@example.com", user_type="admin", admin_role="admin")
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(db_session, client_user_id=client_id, vendor_user_id=vendor_id)
    response = await client.patch(
        f"/api/v1/admin/bookings/{booking_id}/support-hold", json={"hold": True}, headers=_auth(staff_token)
    )
    assert (response.status_code, response.json()["detail"]) == (403, SUPER_ADMIN_ONLY)


async def test_support_hold_toggles_and_persists(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    super_admin_token = await make_actor(
        "admin-hold-ok-super@example.com", user_type="admin", admin_role="super_admin"
    )
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    booking_id = await _booking(db_session, client_user_id=client_id, vendor_user_id=vendor_id)

    held = await client.patch(
        f"/api/v1/admin/bookings/{booking_id}/support-hold",
        json={"hold": True},
        headers=_auth(super_admin_token),
    )
    assert held.status_code == 200
    assert held.json()["booking"]["support"]["support_hold"] is True

    released = await client.patch(
        f"/api/v1/admin/bookings/{booking_id}/support-hold",
        json={"hold": False},
        headers=_auth(super_admin_token),
    )
    assert released.status_code == 200
    assert released.json()["booking"]["support"]["support_hold"] is False


# --- financials -----------------------------------------------------------------------------


async def test_financials_summary_requires_sign_in(client: AsyncClient) -> None:
    response = await client.get("/api/v1/admin/financials/summary")
    assert response.status_code == 401


async def test_financials_summary_is_forbidden_for_a_vendor(client: AsyncClient, make_actor: Any) -> None:
    token = await make_actor("admin-fin-vendor@example.com", user_type="vendor")
    response = await client.get("/api/v1/admin/financials/summary", headers=_auth(token))
    assert (response.status_code, response.json()["detail"]) == (403, ADMIN_PORTAL_FORBIDDEN)


async def test_financials_summary_totals_a_paid_booking(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any, parties: tuple[str, str]
) -> None:
    staff_token = await make_actor("admin-fin-staff@example.com", user_type="admin", admin_role="admin")
    client_token, vendor_token = parties
    client_id, vendor_id = await _ids_from_tokens(client_token, vendor_token, client)
    paid_day = date(2031, 3, 17)
    await _booking(
        db_session,
        client_user_id=client_id,
        vendor_user_id=vendor_id,
        status="accepted",
        payment_status="paid",
        payment_amount_gbp=157.5,
        vendor_amount_gbp=150.0,
        platform_fee_gbp=7.5,
        paid_at=f"{paid_day.isoformat()}T12:00:00+00:00",
    )
    response = await client.get(
        "/api/v1/admin/financials/summary",
        params={"date_from": paid_day.isoformat(), "date_to": (paid_day + timedelta(days=1)).isoformat()},
        headers=_auth(staff_token),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["paid_booking_count"] == 1
    assert body["gmv_gbp"] == 157.5
    assert body["platform_fee_gbp"] == 7.5
    assert body["vendor_portion_gbp"] == 150.0
    assert body["held_in_platform_balance_gbp"] == 150.0
    assert body["payout_released_gbp"] == 0.0


async def test_financials_export_requires_super_admin(client: AsyncClient, make_actor: Any) -> None:
    staff_token = await make_actor(
        "admin-fin-export-staff@example.com", user_type="admin", admin_role="admin"
    )
    response = await client.get("/api/v1/admin/financials/export.csv", headers=_auth(staff_token))
    assert (response.status_code, response.json()["detail"]) == (403, SUPER_ADMIN_ONLY)


async def test_financials_export_returns_a_csv_attachment_and_logs_the_export(
    client: AsyncClient, db_session: AsyncSession, make_actor: Any
) -> None:
    super_admin_token = await make_actor(
        "admin-fin-export-super@example.com", user_type="admin", admin_role="super_admin"
    )
    response = await client.get(
        "/api/v1/admin/financials/export.csv",
        params={"date_from": "2030-01-01", "date_to": "2030-01-02"},
        headers=_auth(super_admin_token),
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == 'attachment; filename="eventtz-financials.csv"'
    header_line = response.text.splitlines()[0]
    assert header_line == (
        "booking_id,status,payment_status,event_name,paid_at,client_total_gbp,vendor_portion_gbp,"
        "service_fee_gbp,payment_amount_gbp,payout_released_at"
    )

    from sqlalchemy import text  # noqa: PLC0415 - only this assertion reads the audit table directly

    audit = await db_session.execute(
        text(
            "select action from admin_audit_log "
            "where action = 'financials.export_csv' order by created_at desc limit 1"
        )
    )
    assert audit.first() is not None
