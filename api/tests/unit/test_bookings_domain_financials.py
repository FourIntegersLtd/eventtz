"""Pence maths for the admin financials summary, with literal expected totals.

The £150-package scenario mirrors the acceptance fixture (`_seed_booking_row` +
5% service fee): a £157.50 client total, £150 vendor portion, £7.50 fee.
"""

from __future__ import annotations

from app.features.bookings.domain_financials import (
    CSV_HEADER,
    DISCLAIMER,
    PaidBookingFinancials,
    gbp_from_pence,
    pence_from_gbp,
    summarize,
)


def _paid_booking(**overrides: object) -> PaidBookingFinancials:
    """A £150 package, held (payment_status "paid"), with `overrides` applied."""
    values: dict[str, object] = {
        "booking_id": "11111111-1111-4111-8111-111111111111",
        "status": "accepted",
        "payment_status": "paid",
        "breakdown_client_total_pence": 15750,
        "breakdown_vendor_portion_pence": 15000,
        "breakdown_service_fee_pence": 750,
        "payment_amount_snapshot_pence": 15750,
        "vendor_amount_snapshot_pence": 15000,
        "platform_fee_snapshot_pence": 750,
    }
    values.update(overrides)
    return PaidBookingFinancials(**values)


def test_pence_from_gbp_rounds_to_the_nearest_penny() -> None:
    assert pence_from_gbp(157.5) == 15750
    assert pence_from_gbp(None) == 0


def test_gbp_from_pence_rounds_to_the_penny() -> None:
    assert gbp_from_pence(15750) == 157.5
    assert gbp_from_pence(7) == 0.07


def test_summarize_one_paid_booking_uses_its_stored_snapshots() -> None:
    summary = summarize([_paid_booking()])
    assert summary.paid_booking_count == 1
    assert summary.gmv_pence == 15750
    assert summary.platform_fee_pence == 750
    assert summary.vendor_portion_pence == 15000
    assert summary.held_in_platform_balance_pence == 15000
    assert summary.payout_released_pence == 0


def test_summarize_a_released_payout_moves_the_vendor_amount_out_of_held() -> None:
    summary = summarize([_paid_booking(payment_status="payout_released")])
    assert summary.held_in_platform_balance_pence == 0
    assert summary.payout_released_pence == 15000
    # gmv and platform fee are unaffected by which side of the split the vendor portion sits on.
    assert summary.gmv_pence == 15750
    assert summary.platform_fee_pence == 750


def test_summarize_falls_back_to_the_priced_breakdown_when_no_snapshot_was_stored() -> None:
    booking = _paid_booking(
        payment_amount_snapshot_pence=None,
        vendor_amount_snapshot_pence=None,
        platform_fee_snapshot_pence=None,
    )
    summary = summarize([booking])
    assert summary.gmv_pence == 15750
    assert summary.platform_fee_pence == 750
    assert summary.held_in_platform_balance_pence == 15000


def test_summarize_totals_more_than_one_booking() -> None:
    summary = summarize(
        [_paid_booking(), _paid_booking(booking_id="second", payment_status="payout_released")]
    )
    assert summary.paid_booking_count == 2
    assert summary.gmv_pence == 31500
    assert summary.vendor_portion_pence == 30000
    assert summary.held_in_platform_balance_pence == 15000
    assert summary.payout_released_pence == 15000


def test_summarize_an_empty_page_is_all_zeroes() -> None:
    summary = summarize([])
    assert summary.paid_booking_count == 0
    assert summary.gmv_pence == 0
    assert summary.held_in_platform_balance_pence == 0


def test_disclaimer_and_csv_header_are_the_baseline_copy_verbatim() -> None:
    assert DISCLAIMER == (
        "Figures derive from stored line items and adjustments plus the configured service fee. "
        "Stripe settlement may differ until payment webhooks persist amounts."
    )
    assert CSV_HEADER == (
        "booking_id",
        "status",
        "payment_status",
        "event_name",
        "paid_at",
        "client_total_gbp",
        "vendor_portion_gbp",
        "service_fee_gbp",
        "payment_amount_gbp",
        "payout_released_at",
    )
