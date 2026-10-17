"""The client-cancellation presets: which tier applies, cooling-off, and the pence split.

Every boundary is asserted with literal values; the presets are the Terms of Service
in code, so a change here is a change to what clients and vendors were promised.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.features.bookings import domain_cancellation
from app.features.bookings.rows import BookingRow
from app.features.vendors import domain_profile_form

NOW = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def _booking(**overrides: object) -> BookingRow:
    """A paid, accepted booking of GBP 150 (client paid 157.50) on 1 June 2026, Strict policy."""
    values: dict[str, object] = {
        "id": "booking-1",
        "client_user_id": "client-1",
        "vendor_user_id": "vendor-1",
        "status": "accepted",
        "payment_status": "paid",
        "event_date": "2026-06-01",
        "payment_amount_gbp": 157.5,
        "vendor_amount_gbp": 150.0,
        "paid_at": "2025-12-01T10:00:00+00:00",
        "cancellation_policy": "strict",
    }
    values.update(overrides)
    return BookingRow.model_validate(values)


def test_the_vendor_form_offers_exactly_the_presets_the_bookings_slice_prices() -> None:
    """The vendors slice repeats the keys (slices meet only at services); they must not drift."""
    assert domain_profile_form.CANCELLATION_POLICY_KEYS == domain_cancellation.PRESET_KEYS
    assert domain_profile_form.DEFAULT_CANCELLATION_POLICY == domain_cancellation.DEFAULT_PRESET


def test_each_preset_tier_boundary() -> None:
    """The first tier whose threshold the day count meets applies; below the last threshold is 0."""
    strict = domain_cancellation.STRICT
    assert [domain_cancellation.tier_percent(strict, days) for days in (90, 89, 60, 59, 30, 29, 0, -1)] == [
        100,
        75,
        75,
        50,
        50,
        0,
        0,
        0,
    ]
    moderate = domain_cancellation.MODERATE
    assert [domain_cancellation.tier_percent(moderate, days) for days in (30, 29, 7, 6, 0)] == [
        100,
        50,
        50,
        0,
        0,
    ]
    flexible = domain_cancellation.FLEXIBLE
    assert [domain_cancellation.tier_percent(flexible, days) for days in (7, 6, 2, 1)] == [100, 50, 50, 0]


def test_an_unknown_preset_reads_as_flexible() -> None:
    """A stored key that is not a preset (or nothing) falls back to the most client-friendly one."""
    assert domain_cancellation.normalize_preset("STRICT ") == "strict"
    assert domain_cancellation.normalize_preset("premium") == "flexible"
    assert domain_cancellation.normalize_preset(None) == "flexible"
    assert domain_cancellation.preset_label("premium") == "Flexible"


def test_days_before_event_count_from_the_first_day() -> None:
    """A multi-day event is measured to its first day; the day itself is day 0."""
    booking = _booking(event_date="2026-06-01", event_end_date="2026-06-03")
    assert domain_cancellation.days_before_event(booking, NOW) == 151
    assert domain_cancellation.days_before_event(booking, datetime(2026, 6, 1, 23, tzinfo=UTC)) == 0
    assert domain_cancellation.days_before_event(_booking(event_date="junk"), NOW) is None


def test_strict_at_45_days_refunds_the_fee_plus_half_the_vendor_price() -> None:
    """GBP 7.50 fee + 50% of GBP 150 = GBP 82.50 back; the vendor keeps GBP 75."""
    settlement = domain_cancellation.settlement(_booking(), datetime(2026, 4, 17, tzinfo=UTC))
    assert settlement == domain_cancellation.CancellationSettlement(
        policy="strict", refund_percent=50, refund_pence=8250, vendor_share_pence=7500, cooling_off=False
    )
    assert not settlement.full_refund


def test_strict_at_10_days_refunds_only_the_fee() -> None:
    """0%: the service fee still comes back, the vendor keeps their whole price."""
    settlement = domain_cancellation.settlement(_booking(), datetime(2026, 5, 22, tzinfo=UTC))
    assert (settlement.refund_percent, settlement.refund_pence, settlement.vendor_share_pence) == (
        0,
        750,
        15000,
    )


def test_a_referral_discount_shrinks_the_fee_part_of_the_refund() -> None:
    """Client paid 152.25 for a 150 vendor price: only 2.25 is non-vendor money."""
    booking = _booking(payment_amount_gbp=152.25)
    settlement = domain_cancellation.settlement(booking, datetime(2026, 4, 17, tzinfo=UTC))
    assert (settlement.refund_pence, settlement.vendor_share_pence) == (7725, 7500)


def test_a_vendor_amount_above_the_payment_is_clamped() -> None:
    """A bad snapshot cannot refund or transfer more than the client paid."""
    booking = _booking(payment_amount_gbp=100.0, vendor_amount_gbp=150.0)
    settlement = domain_cancellation.settlement(booking, datetime(2026, 4, 17, tzinfo=UTC))
    assert (settlement.refund_pence, settlement.vendor_share_pence) == (5000, 5000)


def test_seventy_five_percent_rounds_to_the_nearest_penny() -> None:
    """75% of GBP 33.33 is 24.9975: the client gets 25.00 of it, the vendor 8.33."""
    booking = _booking(payment_amount_gbp=35.0, vendor_amount_gbp=33.33)
    settlement = domain_cancellation.settlement(booking, datetime(2026, 3, 15, tzinfo=UTC))
    assert (settlement.refund_percent, settlement.refund_pence, settlement.vendor_share_pence) == (
        75,
        2667,
        833,
    )


def test_cooling_off_gives_a_full_refund_within_24h_of_paying() -> None:
    """Paid 23h ago, event 10 days out, Strict: cooling-off beats the 0% tier."""
    booking = _booking(paid_at="2026-05-21T11:00:00+00:00")
    now = datetime(2026, 5, 22, 10, 0, tzinfo=UTC)
    assert domain_cancellation.in_cooling_off(booking, now)
    settlement = domain_cancellation.settlement(booking, now)
    assert (settlement.refund_percent, settlement.cooling_off, settlement.full_refund) == (100, True, True)
    assert domain_cancellation.cooling_off_until(booking) == datetime(2026, 5, 22, 11, 0, tzinfo=UTC)


def test_cooling_off_needs_the_event_at_least_7_days_away() -> None:
    """Paid an hour ago but the event is in 6 days: the tier applies."""
    booking = _booking(paid_at="2026-05-26T09:00:00+00:00")
    assert not domain_cancellation.in_cooling_off(booking, datetime(2026, 5, 26, 10, 0, tzinfo=UTC))
    assert domain_cancellation.refund_percent(booking, datetime(2026, 5, 26, 10, 0, tzinfo=UTC)) == (0, False)


def test_cooling_off_ends_after_24_hours() -> None:
    """Paid 25h ago: the tier applies."""
    booking = _booking(paid_at="2026-04-16T09:00:00+00:00")
    assert not domain_cancellation.in_cooling_off(booking, datetime(2026, 4, 17, 10, 0, tzinfo=UTC))


def test_a_booking_paid_before_presets_existed_refunds_in_full() -> None:
    """NULL policy: the client paid under the old terms, so the old full refund stands."""
    booking = _booking(cancellation_policy=None)
    settlement = domain_cancellation.settlement(booking, datetime(2026, 5, 31, tzinfo=UTC))
    assert (settlement.policy, settlement.refund_percent, settlement.refund_pence) == (None, 100, 15750)
    assert settlement.full_refund
    assert domain_cancellation.next_tier_change(booking, NOW) is None


def test_next_tier_change_names_the_day_the_refund_drops() -> None:
    """Strict, 151 days out: 100% until 90 days out, then 75% from 3 March 2026."""
    assert domain_cancellation.next_tier_change(_booking(), NOW) == (datetime(2026, 3, 4).date(), 75)
    at_45_days = datetime(2026, 4, 17, tzinfo=UTC)
    assert domain_cancellation.next_tier_change(_booking(), at_45_days) == (datetime(2026, 5, 3).date(), 0)
    at_10_days = datetime(2026, 5, 22, tzinfo=UTC)
    assert domain_cancellation.next_tier_change(_booking(), at_10_days) is None


def test_describe_preset_reads_as_the_terms() -> None:
    """The lines shown at checkout, on the vendor page and in the Terms."""
    assert domain_cancellation.describe_preset("strict") == [
        "90 or more days before the event: full refund of the vendor's price",
        "60 to 89 days before the event: 75% refund of the vendor's price",
        "30 to 59 days before the event: 50% refund of the vendor's price",
        "Less than 30 days before the event: no refund of the vendor's price",
        "Within 24 hours of paying, if the event is at least 7 days away: full refund",
        "The Eventtz service fee is always refunded",
    ]
    assert domain_cancellation.describe_preset("flexible")[:3] == [
        "7 or more days before the event: full refund of the vendor's price",
        "2 to 6 days before the event: 50% refund of the vendor's price",
        "Less than 2 days before the event: no refund of the vendor's price",
    ]
