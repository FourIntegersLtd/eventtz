"""Vendors must always see booking venue; personal contact stays gated until paid."""

from __future__ import annotations

from app.features.settings.contact import apply_counterparty_contact_visibility


def _pending_detail() -> dict:
    return {
        "id": "b1",
        "client_user_id": "c1",
        "client_email": "client@example.com",
        "event_address": "The Grand Hall, 12 Park Lane, London",
        "event_postcode": "W1K 1BE",
        "counterparty_phone": "07700 900000",
    }


def test_vendor_sees_venue_on_pending_unpaid_booking():
    out = apply_counterparty_contact_visibility(
        viewer_role="vendor",
        booking_status="pending",
        payment_status="unpaid",
        detail=_pending_detail(),
    )
    assert out["event_address"] == "The Grand Hall, 12 Park Lane, London"
    assert out["event_postcode"] == "W1K 1BE"


def test_vendor_does_not_see_email_or_phone_before_payment():
    out = apply_counterparty_contact_visibility(
        viewer_role="vendor",
        booking_status="pending",
        payment_status="unpaid",
        detail=_pending_detail(),
    )
    assert out["client_email"] is None
    assert "counterparty_phone" not in out


def test_vendor_sees_venue_on_accepted_unpaid_booking():
    out = apply_counterparty_contact_visibility(
        viewer_role="vendor",
        booking_status="accepted",
        payment_status="unpaid",
        detail=_pending_detail(),
    )
    assert out["event_address"] == "The Grand Hall, 12 Park Lane, London"
