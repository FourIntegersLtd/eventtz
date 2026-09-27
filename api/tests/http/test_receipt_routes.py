"""HTTP tests for client receipts and vendor payment record / payout statement routes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository
from app.features.vendors import repository as vendors_repository

pytestmark = [pytest.mark.db, pytest.mark.e2e]

PACKAGE = {"id": "pkg-1", "title": "Classic Package", "price": "150", "pricingMode": "fixed"}
LINE_ITEM = {"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}


async def _account(session: AsyncSession, email: str, user_type: str) -> tuple[str, str]:
    """Create a verified account and return `(id, bearer token)`."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    return account_id, issue_access_token(user_id=account_id, email=email, settings=get_settings())


async def _vendor(session: AsyncSession, email: str) -> tuple[str, str]:
    """An approved listed vendor and bearer token."""
    vendor_id, token = await _account(session, email, "vendor")
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "receipt http tests",
            "payload": {"businessName": f"Vendor {email}", "maxBookingsPerDay": "20", "packages": [PACKAGE]},
        },
        exists=False,
    )
    assert saved
    return vendor_id, token


async def _paid_booking(session: AsyncSession, *, client_id: str, vendor_id: str, **columns: Any) -> str:
    """Insert a paid booking and return its id."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "status": "accepted",
            "payment_status": "paid",
            "initiator": "client",
            "event_name": "Receipt route test",
            "event_date": "2099-01-01",
            "total_label": "GBP 157.50",
            "line_items": [LINE_ITEM],
            "vendor_adjustments": [],
            "payment_amount_gbp": 157.5,
            "vendor_amount_gbp": 142.5,
            "platform_fee_gbp": 7.5,
            "paid_at": "2030-01-01T12:00:00+00:00",
            **columns,
        },
    )
    return booking.id


@pytest.mark.asyncio
async def test_client_receipt_json(client: AsyncClient, db_session: AsyncSession) -> None:
    client_id, token = await _account(db_session, "client-receipt@example.com", "client")
    vendor_id, _ = await _vendor(db_session, "vendor-receipt@example.com")
    booking_id = await _paid_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    snapshot = {
        "document_type": "client_payment_receipt",
        "receipt_number": "EVT-TEST0001",
        "booking_request_id": booking_id,
        "event_name": "Receipt route test",
        "event_date": "2099-01-01",
        "payment_status": "paid",
        "paid_at": "2030-01-01T12:00:00+00:00",
        "payout_released_at": None,
        "counterparty_name": "Test Vendor",
        "line_items": [{"label": "Classic Package", "amount_label": "GBP 150"}],
        "subtotal_label": "GBP 150",
        "service_fee_label": "GBP 7.50",
        "service_fee_percent": 5.0,
        "total_label": "GBP 157.50",
        "vendor_share_label": None,
        "platform_fee_label": None,
        "payment_reference": None,
        "transfer_reference": None,
        "stripe_receipt_url": None,
        "status_note": None,
    }
    await bookings_repository.update_booking(
        db_session, booking_id, {"payment_receipt_snapshot": snapshot}, payment_status_in={"paid"}
    )
    response = await client.get(
        f"/api/v1/client/booking-requests/{booking_id}/receipt",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["receipt"]["total_label"] == "GBP 157.50"
    assert body["receipt"]["booking_request_id"] == booking_id


@pytest.mark.asyncio
async def test_vendor_payment_record_json(client: AsyncClient, db_session: AsyncSession) -> None:
    client_id, _ = await _account(db_session, "client-vendor-rec@example.com", "client")
    vendor_id, vendor_token = await _vendor(db_session, "vendor-rec@example.com")
    booking_id = await _paid_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    response = await client.get(
        f"/api/v1/vendor/booking-requests/{booking_id}/payment-record",
        headers={"Authorization": f"Bearer {vendor_token}"},
    )
    assert response.status_code == 200
    assert response.json()["receipt"]["vendor_share_label"] == "GBP 142.50"


@pytest.mark.asyncio
async def test_vendor_payout_statement_requires_release(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    client_id, _ = await _account(db_session, "client-payout@example.com", "client")
    vendor_id, vendor_token = await _vendor(db_session, "vendor-payout@example.com")
    booking_id = await _paid_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    response = await client.get(
        f"/api/v1/vendor/booking-requests/{booking_id}/payout-statement",
        headers={"Authorization": f"Bearer {vendor_token}"},
    )
    assert response.status_code == 404
    assert response.json()["code"] == "receipt_not_available"
