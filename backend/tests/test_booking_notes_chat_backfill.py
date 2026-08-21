"""Tests for booking notes backfill into chat on detail fetch."""

from __future__ import annotations

from unittest.mock import patch

from app.features.bookings.queries import _backfill_notes_chat_on_detail


@patch("app.features.bookings.queries.ensure_client_booking_notes_in_chat")
def test_vendor_quote_notes_do_not_backfill_to_chat(mock_ensure):
    row = {
        "initiator": "vendor",
        "client_user_id": "client-1",
        "vendor_user_id": "vendor-1",
    }
    out = {
        "id": "booking-1",
        "notes": "Includes setup, teardown, and travel within 20 miles.",
        "conversation_id": "conv-1",
    }

    _backfill_notes_chat_on_detail(row, out)

    mock_ensure.assert_not_called()


@patch("app.features.bookings.queries.ensure_client_booking_notes_in_chat")
def test_client_booking_notes_still_backfill_to_chat(mock_ensure):
    mock_ensure.return_value = "conv-1"
    row = {
        "initiator": "client",
        "client_user_id": "client-1",
        "vendor_user_id": "vendor-1",
    }
    out = {
        "id": "booking-1",
        "notes": "We need vegetarian options for 40 guests.",
        "conversation_id": None,
    }

    _backfill_notes_chat_on_detail(row, out)

    mock_ensure.assert_called_once_with(
        booking_id="booking-1",
        client_user_id="client-1",
        vendor_user_id="vendor-1",
        notes="We need vegetarian options for 40 guests.",
        conversation_id=None,
    )
    assert out["conversation_id"] == "conv-1"
