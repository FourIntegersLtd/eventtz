"""Vendor payout ledger: vendor share only, paid/payout_released only."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.features.bookings.payout_history import list_vendor_payouts, vendor_amount_for_row


def test_vendor_amount_prefers_snapshot() -> None:
    assert vendor_amount_for_row({"vendor_amount_gbp": 100.5, "line_items": []}) == 100.5


def test_vendor_amount_falls_back_to_pricing() -> None:
    row = {
        "vendor_amount_gbp": None,
        "line_items": [{"label": "DJ", "unit_price_gbp": 80, "quantity": 1}],
        "vendor_adjustments": [],
    }
    assert vendor_amount_for_row(row) == 80.0


@patch("app.features.bookings.payout_history.client_display_names_by_id", return_value={})
@patch("app.features.bookings.payout_history.get_client")
@patch("app.features.bookings.payout_history.get_settings")
def test_list_vendor_payouts_excludes_pending_and_uses_vendor_share(
    mock_settings: MagicMock,
    mock_get_client: MagicMock,
    _mock_names: MagicMock,
) -> None:
    mock_settings.return_value.local_auth_mode = False
    mock_get_client.return_value.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "b-released",
                "event_name": "Wedding",
                "event_date": "2026-08-01",
                "client_user_id": "c1",
                "created_at": "2026-07-01T00:00:00Z",
                "paid_at": "2026-07-02T00:00:00Z",
                "payment_status": "payout_released",
                "vendor_amount_gbp": 1.0,
                "payout_released_at": "2026-08-09T19:30:00Z",
                "line_items": [],
                "vendor_adjustments": [],
            },
            {
                "id": "b-awaiting",
                "event_name": "Party",
                "event_date": "2026-08-10",
                "client_user_id": "c2",
                "created_at": "2026-08-01T00:00:00Z",
                "paid_at": "2026-08-02T00:00:00Z",
                "payment_status": "paid",
                "vendor_amount_gbp": 50.0,
                "payout_released_at": None,
                "line_items": [],
                "vendor_adjustments": [],
            },
        ],
    )

    out = list_vendor_payouts("vendor-1")

    assert out["total_paid_out_gbp"] == 1.0
    assert out["total_awaiting_gbp"] == 50.0
    assert len(out["payouts"]) == 2
    assert out["payouts"][0]["status"] == "paid_out"
    assert out["payouts"][0]["amount_gbp"] == 1.0
    assert out["payouts"][1]["status"] == "awaiting_payout"
    # Never the client total (£1.05 with fee) - vendor share only.
    assert all(p["amount_gbp"] != 1.05 for p in out["payouts"])
