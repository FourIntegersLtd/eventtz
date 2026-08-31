"""Tests for vendor client referral tier discounts."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.core.constants import BOOKING_SERVICE_FEE_PERCENT
from app.features.bookings.pricing import build_pricing_breakdown
from app.features.vendor_referrals.codes import (
    generate_unique_referral_code,
    normalize_client_referral_code,
    set_vendor_referral_code,
)
from app.features.vendor_referrals.tiers import referral_fee_discount_for_spend
from app.features.vendor_referrals.booking_discount import (
    build_initial_pricing_breakdown_for_booking_row,
    build_pricing_breakdown_for_booking_row,
)
from app.features.vendor_referrals.validate import (
    preview_referral_discount_for_vendor,
    resolve_referral_pricing_inputs,
)


def test_resolve_booking_service_fee_percent_defaults_to_standard():
    from app.features.bookings.pricing import resolve_booking_service_fee_percent

    assert resolve_booking_service_fee_percent({"service_fee_percent": 5.0}) == 5.0
    assert resolve_booking_service_fee_percent({}) == BOOKING_SERVICE_FEE_PERCENT


def test_referral_fee_applied_flag_on_breakdown():
    pb = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": 400.0}],
        vendor_adjustments=[],
        referral_fee_discount_gbp=10.0,
    )
    assert pb["referral_fee_applied"] is True
    pb_no = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": 100.0}],
        vendor_adjustments=[],
    )
    assert pb_no["referral_fee_applied"] is False


def test_referral_tier_selection():
    assert referral_fee_discount_for_spend(399) == 0.0
    assert referral_fee_discount_for_spend(400) == 10.0
    assert referral_fee_discount_for_spend(599) == 10.0
    assert referral_fee_discount_for_spend(600) == 15.0


def test_normalize_client_referral_code():
    assert normalize_client_referral_code("  482910 ") == "482910"
    assert normalize_client_referral_code("48-29-10") == "482910"
    assert normalize_client_referral_code("1234567") is None
    assert normalize_client_referral_code("!!!") is None
    assert normalize_client_referral_code("0") == "0"


@patch("app.features.vendor_referrals.codes._code_taken", return_value=False)
def test_generate_unique_referral_code_is_six_digits(_mock_taken: MagicMock) -> None:
    code = generate_unique_referral_code()
    assert len(code) == 6
    assert code.isdigit()


@patch("app.features.vendor_referrals.codes._code_taken", return_value=False)
@patch("app.features.vendor_referrals.codes.get_db")
def test_set_vendor_referral_code_custom(mock_db: MagicMock, _mock_taken: MagicMock) -> None:
    table = MagicMock()
    mock_db.return_value.table.return_value = table
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"user_id": "vendor-1", "approval_status": "approved", "client_referral_code": None},
    ]
    table.update.return_value.eq.return_value.execute.return_value.data = [{}]

    code = set_vendor_referral_code("vendor-1", "1234")
    assert code == "1234"


@patch("app.features.vendor_referrals.codes._code_taken", return_value=False)
@patch("app.features.vendor_referrals.codes.get_db")
def test_set_vendor_referral_code_locked_after_first_set(mock_db: MagicMock, _mock_taken: MagicMock) -> None:
    table = MagicMock()
    mock_db.return_value.table.return_value = table
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"user_id": "vendor-1", "approval_status": "approved", "client_referral_code": "224974"},
    ]

    with pytest.raises(ValueError, match="cannot be changed"):
        set_vendor_referral_code("vendor-1", "999999", generate=False)

    with pytest.raises(ValueError, match="cannot be changed"):
        set_vendor_referral_code("vendor-1", None, generate=True)

    assert set_vendor_referral_code("vendor-1", "224974") == "224974"


@patch("app.features.vendor_referrals.bookings.apply_recent_first_order", side_effect=lambda q, **_: q)
@patch("app.features.vendor_referrals.bookings.build_pricing_breakdown_for_booking_row")
@patch("app.features.vendor_referrals.bookings.client_display_names_by_id", return_value={})
@patch("app.features.vendor_referrals.bookings.get_db")
def test_list_referral_bookings_includes_retired_codes(
    mock_db: MagicMock,
    _mock_names: MagicMock,
    mock_pb: MagicMock,
    _mock_order: MagicMock,
) -> None:
    from app.features.vendor_referrals.bookings import list_vendor_referral_bookings

    mock_pb.return_value = {
        "vendor_portion_gbp": 500.0,
        "referral_fee_discount_gbp": 10.0,
    }
    table = MagicMock()
    mock_db.return_value.table.return_value = table
    table.select.return_value = table
    table.eq.return_value = table
    table.not_.is_.return_value = table
    table.limit.return_value = table
    table.execute.return_value.data = [
        {
            "id": "b-old",
            "status": "accepted",
            "payment_status": "paid",
            "event_name": "Party",
            "event_date": "2026-08-31",
            "client_user_id": "c1",
            "vendor_referral_code": "111111",
            "referral_fee_discount_gbp": 10.0,
        },
        {
            "id": "b-new",
            "status": "pending",
            "payment_status": "unpaid",
            "event_name": "Wedding",
            "event_date": "2026-09-01",
            "client_user_id": "c2",
            "vendor_referral_code": "224974",
            "referral_fee_discount_gbp": 0.0,
        },
    ]

    out = list_vendor_referral_bookings("vendor-1")
    assert out["total_referral_bookings"] == 2
    codes = {row["referral_code"] for row in out["bookings"]}
    assert codes == {"111111", "224974"}


@patch("app.features.vendor_referrals.validate.get_vendor_referral_row_by_code")
def test_resolve_referral_pricing_inputs_valid(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    code, discount, tier_min = resolve_referral_pricing_inputs("vendor-1", "482910", 600.0)
    assert code == "482910"
    assert discount == 15.0
    assert tier_min == 600.0


@patch("app.features.vendor_referrals.validate.get_vendor_referral_row_by_code")
def test_resolve_referral_pricing_inputs_under_tier(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    code, discount, tier_min = resolve_referral_pricing_inputs("vendor-1", "482910", 350.0)
    assert code == "482910"
    assert discount == 0.0
    assert tier_min is None


@patch("app.features.vendor_referrals.validate.get_vendor_referral_row_by_code")
def test_resolve_referral_pricing_inputs_wrong_vendor(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-2",
        "client_referral_enabled": True,
        "approval_status": "approved",
    }
    with pytest.raises(ValueError):
        resolve_referral_pricing_inputs("vendor-1", "482910", 400.0)


@patch("app.features.vendor_referrals.validate.get_vendor_referral_row_by_code")
def test_preview_referral_discount_for_vendor(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    preview = preview_referral_discount_for_vendor("vendor-1", "482910", 400.0)
    assert preview["code_valid"] is True
    assert preview["valid"] is True
    assert preview["qualified_discount_gbp"] == 10.0
    assert preview["service_fee_gbp"] == 10.0
    assert preview["service_fee_before_discount_gbp"] == 20.0


@patch("app.features.vendor_referrals.validate.get_vendor_referral_row_by_code")
def test_preview_referral_code_valid_under_tier(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    preview = preview_referral_discount_for_vendor("vendor-1", "482910", 350.0)
    assert preview["code_valid"] is True
    assert preview["valid"] is False
    assert preview["qualified_discount_gbp"] == 0.0


@patch("app.features.vendor_referrals.validate.get_vendor_referral_row_by_code")
def test_preview_referral_discount_invalid_code(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = None
    preview = preview_referral_discount_for_vendor("vendor-1", "999999", 400.0)
    assert preview["code_valid"] is False
    assert preview["valid"] is False
    assert preview["qualified_discount_gbp"] == 0.0
    assert preview["service_fee_percent"] == BOOKING_SERVICE_FEE_PERCENT


def _assert_payment_invariant(pb: dict[str, object]) -> None:
    vendor = float(pb["vendor_portion_gbp"])
    fee = float(pb["service_fee_gbp"])
    total = float(pb["client_total_gbp"])
    assert round(vendor + fee, 2) == total


_BOOKING_ROW_LOOKUP = "app.features.vendor_referrals.booking_discount.get_vendor_referral_row_by_code"


@patch(_BOOKING_ROW_LOOKUP)
def test_build_pricing_breakdown_for_booking_row_applies_tier(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    row = {
        "vendor_user_id": "vendor-1",
        "vendor_referral_code": "482910",
        "line_items": [{"unit_price_gbp": 380.0}],
        "vendor_adjustments": [{"id": "a1", "tag": "other", "label": "setup", "amount_gbp": 20.0}],
        "service_fee_percent": 5.0,
    }
    pb = build_pricing_breakdown_for_booking_row(row)
    assert float(pb["vendor_portion_gbp"]) == 400.0
    assert float(pb["referral_fee_discount_gbp"]) == 10.0
    assert float(pb["service_fee_gbp"]) == 10.0
    assert float(pb["client_total_gbp"]) == 410.0
    _assert_payment_invariant(pb)


@patch(_BOOKING_ROW_LOOKUP)
def test_build_pricing_breakdown_for_booking_row_middle_tier(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "1234",
    }
    row = {
        "vendor_user_id": "vendor-1",
        "vendor_referral_code": "1234",
        "line_items": [{"unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "service_fee_percent": 5.0,
    }
    pb = build_pricing_breakdown_for_booking_row(row)
    assert float(pb["referral_fee_discount_gbp"]) == 10.0
    assert float(pb["service_fee_gbp"]) == 15.0
    assert float(pb["client_total_gbp"]) == 515.0
    _assert_payment_invariant(pb)


@patch(_BOOKING_ROW_LOOKUP)
def test_stored_referral_still_applies_when_live_code_is_gone(mock_lookup: MagicMock) -> None:
    """Vendor rotated/disabled the live code — existing bookings keep the tier."""
    mock_lookup.return_value = None
    row = {
        "vendor_user_id": "vendor-1",
        "vendor_referral_code": "254106",
        "line_items": [{"unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "service_fee_percent": 5.0,
    }
    pb = build_pricing_breakdown_for_booking_row(row)
    assert float(pb["referral_fee_discount_gbp"]) == 10.0
    assert float(pb["client_total_gbp"]) == 515.0
    _assert_payment_invariant(pb)


@patch(_BOOKING_ROW_LOOKUP)
def test_stored_referral_recovers_vendor_id_from_code(mock_lookup: MagicMock) -> None:
    """API projections that omit vendor_user_id must still match client totals."""
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": False,
        "approval_status": "approved",
        "client_referral_code": "254106",
    }
    row = {
        "vendor_referral_code": "254106",
        "line_items": [{"unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "service_fee_percent": 5.0,
    }
    pb = build_pricing_breakdown_for_booking_row(row)
    assert float(pb["referral_fee_discount_gbp"]) == 10.0
    assert float(pb["client_total_gbp"]) == 515.0
    _assert_payment_invariant(pb)


@patch(_BOOKING_ROW_LOOKUP)
def test_referral_code_for_another_vendor_does_not_discount(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "other-vendor",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    row = {
        "vendor_user_id": "vendor-1",
        "vendor_referral_code": "482910",
        "line_items": [{"unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "service_fee_percent": 5.0,
    }
    pb = build_pricing_breakdown_for_booking_row(row)
    assert float(pb["referral_fee_discount_gbp"]) == 0.0
    assert float(pb["client_total_gbp"]) == 525.0
    _assert_payment_invariant(pb)


@patch(_BOOKING_ROW_LOOKUP)
def test_stored_code_without_vendor_id_honors_tier(mock_lookup: MagicMock) -> None:
    """Rotated/disabled live code — honor stored code even without vendor_user_id."""
    mock_lookup.return_value = None
    row = {
        "vendor_referral_code": "254106",
        "line_items": [{"unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "service_fee_percent": 5.0,
    }
    pb = build_pricing_breakdown_for_booking_row(row)
    assert float(pb["referral_fee_discount_gbp"]) == 10.0
    assert float(pb["client_total_gbp"]) == 515.0
    _assert_payment_invariant(pb)


@patch("app.features.vendor_referrals.validate.get_vendor_referral_row_by_code")
def test_resolve_referral_pricing_inputs_invalid_code_raises(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = None
    with pytest.raises(ValueError):
        resolve_referral_pricing_inputs("vendor-1", "999999", 500.0)


@patch(_BOOKING_ROW_LOOKUP)
def test_build_pricing_breakdown_uses_normalized_adjustments_for_tier(
    mock_lookup: MagicMock,
) -> None:
    """Tier spend must match vendor_portion_gbp in the same breakdown (rounded adjustments)."""
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    row = {
        "vendor_user_id": "vendor-1",
        "vendor_referral_code": "482910",
        "line_items": [{"unit_price_gbp": 389.99}],
        "vendor_adjustments": [{"id": "a1", "tag": "other", "label": "extra", "amount_gbp": 10.005}],
        "service_fee_percent": 5.0,
    }
    pb = build_pricing_breakdown_for_booking_row(row)
    assert float(pb["vendor_portion_gbp"]) == 400.0
    assert float(pb["referral_fee_discount_gbp"]) == 10.0
    _assert_payment_invariant(pb)


@patch(_BOOKING_ROW_LOOKUP)
def test_build_initial_pricing_ignores_adjustments_for_tier(mock_lookup: MagicMock) -> None:
    """Initial quote tier uses line items only — not surcharges added later."""
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "482910",
    }
    row = {
        "vendor_user_id": "vendor-1",
        "vendor_referral_code": "482910",
        "line_items": [{"unit_price_gbp": 350.0}],
        "vendor_adjustments": [{"id": "a1", "tag": "other", "label": "setup", "amount_gbp": 60.0}],
        "service_fee_percent": 5.0,
    }
    initial = build_initial_pricing_breakdown_for_booking_row(row)
    current = build_pricing_breakdown_for_booking_row(row)
    assert float(initial["referral_fee_discount_gbp"]) == 0.0
    assert float(initial["client_total_gbp"]) == 367.5
    assert float(current["referral_fee_discount_gbp"]) == 10.0
    assert float(current["vendor_portion_gbp"]) == 410.0
    assert float(current["client_total_gbp"]) == 420.5
    _assert_payment_invariant(initial)
    _assert_payment_invariant(current)


@patch(_BOOKING_ROW_LOOKUP)
def test_attach_pricing_from_projection_applies_referral_without_vendor_id(
    mock_lookup: MagicMock,
) -> None:
    from app.features.bookings.queries import _attach_pricing_fields

    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "254106",
    }
    out = {
        "line_items": [{"unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "vendor_referral_code": "254106",
        "service_fee_percent": 5.0,
    }
    _attach_pricing_fields(out)
    assert float(out["pricing"]["referral_fee_discount_gbp"]) == 10.0
    assert float(out["pricing"]["client_total_gbp"]) == 515.0
    assert out["pricing"]["client_total_label"] == "GBP 515"


@patch(_BOOKING_ROW_LOOKUP)
def test_admin_booking_list_item_uses_discounted_client_total(mock_lookup: MagicMock) -> None:
    from app.features.admin.booking_admin_commands import _booking_list_item

    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "254106",
    }
    row = {
        "id": "b1",
        "status": "pending",
        "event_name": "Graduation",
        "event_date": "2026-09-30",
        "client_user_id": "c1",
        "vendor_user_id": "vendor-1",
        "vendor_referral_code": "254106",
        "line_items": [{"unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "service_fee_percent": 5.0,
        "payment_status": "unpaid",
    }
    item = _booking_list_item(row, emails={}, names={}, support=None)
    assert item["client_total_label"] == "GBP 515"

