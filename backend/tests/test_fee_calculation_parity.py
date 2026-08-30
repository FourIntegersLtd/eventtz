"""Plan-table parity checks for tiered referral pricing."""

from __future__ import annotations

from app.features.bookings.pricing import build_pricing_breakdown
from app.features.vendor_referrals.tiers import referral_fee_discount_for_spend


def _client_totals(vendor_portion: float, referral_discount: float) -> tuple[float, float, float]:
    pb = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": vendor_portion}],
        vendor_adjustments=[],
        referral_fee_discount_gbp=referral_discount,
    )
    fee_before = float(pb["service_fee_before_discount_gbp"])
    fee = float(pb["service_fee_gbp"])
    total = float(pb["client_total_gbp"])
    assert fee_before == round(vendor_portion * 0.05, 2)
    discount_applied = round(min(referral_discount, fee_before), 2)
    assert fee == round(max(0.0, fee_before - discount_applied), 2)
    assert total == round(vendor_portion + fee, 2)
    assert float(pb["vendor_portion_gbp"]) + fee == total
    return fee_before, fee, total


def test_plan_table_without_referral():
    assert _client_totals(350, 0) == (17.5, 17.5, 367.5)
    assert _client_totals(50, 0) == (2.5, 2.5, 52.5)


def test_plan_table_with_referral_tiers():
    assert referral_fee_discount_for_spend(400) == 10.0
    assert _client_totals(400, 10) == (20.0, 10.0, 410.0)

    assert referral_fee_discount_for_spend(600) == 15.0
    assert _client_totals(600, 15) == (30.0, 15.0, 615.0)


def test_referral_discount_capped_when_fee_smaller_than_tier():
    assert _client_totals(50, 10) == (2.5, 0.0, 50.0)


def test_surcharge_included_in_fee_base():
    pb = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": 90.0}],
        vendor_adjustments=[{"tag": "other", "label": "setup", "amount_gbp": 20.0}],
    )
    assert float(pb["vendor_portion_gbp"]) == 110.0
    assert float(pb["service_fee_gbp"]) == 5.5
    assert float(pb["client_total_gbp"]) == 115.5


def test_tier_boundaries():
    assert referral_fee_discount_for_spend(399.99) == 0.0
    assert referral_fee_discount_for_spend(400.0) == 10.0
    assert referral_fee_discount_for_spend(500.0) == 10.0
    assert referral_fee_discount_for_spend(599.99) == 10.0
    assert referral_fee_discount_for_spend(600.0) == 15.0


def test_payment_invariant_all_plan_rows():
    cases = [
        (350, 0, 17.5, 367.5),
        (400, 10, 10, 410),
        (500, 10, 15, 515),
        (600, 15, 15, 615),
        (50, 10, 0, 50),
    ]
    for vendor, discount, fee, total in cases:
        pb = build_pricing_breakdown(
            line_items=[{"unit_price_gbp": vendor}],
            vendor_adjustments=[],
            referral_fee_discount_gbp=discount,
        )
        assert float(pb["service_fee_gbp"]) == fee
        assert float(pb["client_total_gbp"]) == total
        assert float(pb["vendor_portion_gbp"]) + float(pb["service_fee_gbp"]) == total
