"""The Terms money rules as pure maths: split payouts, payment deadline, deposits, refund cap, profile limits.

Every expected value is worked out by hand in pence; nothing touches a database or Stripe.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

import pytest

from app.features.bookings import domain_policy
from app.features.bookings.rows import BookingRow
from app.features.vendors.domain_profile_form import validate_step_fields
from app.features.vendors.errors import ProfileInvalid


def _booking(**columns: Any) -> BookingRow:
    """A booking row with only the columns a test names (event on 1 June 2030 unless told otherwise)."""
    defaults: dict[str, Any] = {
        "id": "booking-1",
        "client_user_id": "client-1",
        "vendor_user_id": "vendor-1",
        "status": "accepted",
        "event_date": "2030-06-01",
    }
    return BookingRow(**{**defaults, **columns})


# --- split payouts: the pence --------------------------------------------------------------------------


def test_upfront_part_of_a_150_pound_vendor_share_at_70_percent_is_105_pounds() -> None:
    assert domain_policy.upfront_pence(15000, 70) == 10500
    assert 15000 - domain_policy.upfront_pence(15000, 70) == 4500


def test_upfront_part_rounds_half_a_penny_up_and_the_two_parts_always_add_up() -> None:
    # 15001 * 70% = 10500.7 -> 10501; 12345 * 50% = 6172.5 -> 6173 (half up).
    assert domain_policy.upfront_pence(15001, 70) == 10501
    assert domain_policy.upfront_pence(12345, 50) == 6173
    assert domain_policy.upfront_pence(1, 50) == 1
    assert domain_policy.upfront_pence(0, 80) == 0
    for vendor_pence in (1, 99, 12345, 15001, 99999):
        for percent in (50, 65, 80):
            first_part = domain_policy.upfront_pence(vendor_pence, percent)
            assert 0 <= first_part <= vendor_pence


# --- split payouts: which payout a release makes ---------------------------------------------------------


def test_a_booking_without_a_split_is_always_paid_in_full() -> None:
    assert domain_policy.payout_stage(_booking(), datetime(2030, 6, 5, tzinfo=UTC)) == "full"


def test_a_split_booking_moves_from_upfront_to_waiting_to_final() -> None:
    """Event on 1 June, 14 days to deliver: the rest is due at 00:00 UTC on 16 June."""
    split = {"payout_upfront_percent": 70, "delivery_deadline_days": 14}
    before_upfront = _booking(**split)
    after_upfront = _booking(**split, upfront_payout_at="2030-06-02T10:00:00+00:00", upfront_amount_gbp=105.0)
    confirmed = _booking(
        **split,
        upfront_payout_at="2030-06-02T10:00:00+00:00",
        upfront_amount_gbp=105.0,
        delivery_confirmed_at="2030-06-04T09:00:00+00:00",
    )
    deadline = datetime(2030, 6, 16, tzinfo=UTC)

    assert domain_policy.delivery_due_at(after_upfront) == deadline
    assert domain_policy.payout_stage(before_upfront, deadline + timedelta(days=30)) == "upfront"
    assert domain_policy.payout_stage(after_upfront, deadline - timedelta(seconds=1)) == "waiting_delivery"
    assert domain_policy.payout_stage(after_upfront, deadline) == "final"
    assert domain_policy.payout_stage(confirmed, datetime(2030, 6, 5, tzinfo=UTC)) == "final"


def test_the_delivery_clock_starts_after_the_last_day_of_a_multi_day_event() -> None:
    booking = _booking(payout_upfront_percent=50, delivery_deadline_days=7, event_end_date="2030-06-03")

    assert domain_policy.delivery_due_at(booking) == datetime(2030, 6, 11, tzinfo=UTC)
    assert domain_policy.delivery_due_at(_booking()) is None


def test_held_upfront_is_zero_until_the_first_part_is_actually_paid() -> None:
    assert domain_policy.held_upfront_pence(_booking(upfront_amount_gbp=105.0)) == 0
    paid = _booking(upfront_amount_gbp=105.0, upfront_payout_at="2030-06-02T10:00:00+00:00")
    assert domain_policy.held_upfront_pence(paid) == 10500


def test_split_terms_come_only_from_photography_with_numbers_inside_the_ranges() -> None:
    photography = {"servicesOffered": ["photography"]}
    assert domain_policy.delivery_split_terms(
        {**photography, "deliveryUpfrontPercent": "70", "deliveryDeadlineDays": 14}
    ) == (70, 14)
    assert domain_policy.delivery_split_terms(
        {**photography, "deliveryUpfrontPercent": 50, "deliveryDeadlineDays": 60}
    ) == (50, 60)
    for upfront, days in ((49, 14), (81, 14), (70, 0), (70, 61), (70.5, 14), (None, 14), (70, None)):
        assert (
            domain_policy.delivery_split_terms(
                {**photography, "deliveryUpfrontPercent": upfront, "deliveryDeadlineDays": days}
            )
            is None
        ), (upfront, days)
    caterer = {"servicesOffered": ["catering"], "deliveryUpfrontPercent": 70, "deliveryDeadlineDays": 14}
    assert domain_policy.delivery_split_terms(caterer) is None


# --- checkout snapshot --------------------------------------------------------------------------------------


def test_checkout_snapshot_for_a_photographer_a_renter_and_an_ordinary_vendor() -> None:
    photographer = {
        "servicesOffered": ["photography"],
        "deliveryUpfrontPercent": "70",
        "deliveryDeadlineDays": "14",
    }
    renter = {"servicesOffered": ["Rentals"], "damageDepositGbp": "75.50"}
    assert domain_policy.checkout_terms_columns(photographer, default_report_hours=48) == {
        "report_window_hours": None,
        "payout_upfront_percent": 70,
        "delivery_deadline_days": 14,
        "damage_deposit_gbp": None,
    }
    assert domain_policy.checkout_terms_columns(renter, default_report_hours=48) == {
        "report_window_hours": 96,
        "payout_upfront_percent": None,
        "delivery_deadline_days": None,
        "damage_deposit_gbp": 75.5,
    }
    assert domain_policy.checkout_terms_columns({}, default_report_hours=48) == {
        "report_window_hours": None,
        "payout_upfront_percent": None,
        "delivery_deadline_days": None,
        "damage_deposit_gbp": None,
    }


def test_the_report_window_is_the_longest_category_window_only_when_above_the_default() -> None:
    assert domain_policy.report_window_hours(["catering", "decor"], default_hours=48) == 96
    assert domain_policy.report_window_hours(["catering"], default_hours=48) is None
    assert domain_policy.report_window_hours(["rentals"], default_hours=96) is None


def test_a_deposit_applies_only_to_rentals_and_decor_up_to_1000_pounds() -> None:
    assert (
        domain_policy.damage_deposit_pence({"servicesOffered": ["decor"], "damageDepositGbp": 1000}) == 100000
    )
    assert (
        domain_policy.damage_deposit_pence({"servicesOffered": ["decor"], "damageDepositGbp": "19.99"})
        == 1999
    )
    for bad_value in (1000.01, 0, -5, "abc", True, None, [50]):
        payload = {"servicesOffered": ["rentals"], "damageDepositGbp": bad_value}
        assert domain_policy.damage_deposit_pence(payload) == 0, bad_value
    assert domain_policy.damage_deposit_pence({"servicesOffered": ["catering"], "damageDepositGbp": 50}) == 0


# --- payment deadline ---------------------------------------------------------------------------------------


def test_payment_is_due_72_hours_after_acceptance_when_the_event_is_far_off() -> None:
    due_at = domain_policy.payment_due_at(
        accepted_at=datetime(2030, 1, 10, 12, 0, tzinfo=UTC),
        event_date=date(2030, 6, 1),
        deadline_hours=72,
        rule_starts_on=date(2026, 11, 1),
    )

    assert due_at == datetime(2030, 1, 13, 12, 0, tzinfo=UTC)


def _due(accepted_at: datetime) -> datetime | None:
    """The deadline for a booking for 1 June 2030 accepted at `accepted_at`, under the 2026-11-01 Terms."""
    return domain_policy.payment_due_at(
        accepted_at=accepted_at,
        event_date=date(2030, 6, 1),
        deadline_hours=72,
        rule_starts_on=date(2026, 11, 1),
    )


def test_payment_is_capped_48_hours_before_the_event_starts() -> None:
    """Accepted 28 May noon: 72h would be 31 May noon, but the cap is 30 May 00:00 (event start - 48h)."""
    assert _due(datetime(2030, 5, 28, 12, 0, tzinfo=UTC)) == datetime(2030, 5, 30, 0, 0, tzinfo=UTC)


def test_a_booking_accepted_inside_the_48_hour_cap_is_due_at_the_event_start() -> None:
    """Accepted 31 May 06:00 the cap (30 May) is already past, so it falls back to 1 June 00:00."""
    assert _due(datetime(2030, 5, 31, 6, 0, tzinfo=UTC)) == datetime(2030, 6, 1, 0, 0, tzinfo=UTC)
    # Accepted exactly at the cap moment counts as inside it.
    assert _due(datetime(2030, 5, 30, 0, 0, tzinfo=UTC)) == datetime(2030, 6, 1, 0, 0, tzinfo=UTC)
    # One second before the cap moment, the cap itself applies.
    assert _due(datetime(2030, 5, 29, 23, 59, 59, tzinfo=UTC)) == datetime(2030, 5, 30, 0, 0, tzinfo=UTC)


def test_bookings_accepted_before_the_terms_date_have_no_payment_deadline() -> None:
    """The date is judged in UTC: 00:30 on 1 Nov at +01:00 is still 31 Oct."""
    common = {"event_date": date(2030, 6, 1), "deadline_hours": 72, "rule_starts_on": date(2026, 11, 1)}
    before = domain_policy.payment_due_at(accepted_at=datetime(2026, 10, 31, 23, 59, tzinfo=UTC), **common)
    first_day = domain_policy.payment_due_at(accepted_at=datetime(2026, 11, 1, 0, 0, tzinfo=UTC), **common)
    offset_before = domain_policy.payment_due_at(
        accepted_at=datetime(2026, 11, 1, 0, 30, tzinfo=timezone(timedelta(hours=1))), **common
    )

    assert before is None
    assert first_day == datetime(2026, 11, 4, 0, 0, tzinfo=UTC)
    assert offset_before is None


def test_no_deadline_without_an_acceptance_time_or_an_event_date() -> None:
    assert (
        domain_policy.payment_due_at(
            accepted_at=None, event_date=date(2030, 6, 1), deadline_hours=72, rule_starts_on=None
        )
        is None
    )
    assert (
        domain_policy.payment_due_at(
            accepted_at=datetime(2030, 1, 1, tzinfo=UTC),
            event_date=None,
            deadline_hours=72,
            rule_starts_on=None,
        )
        is None
    )


def test_a_stored_booking_has_a_deadline_only_while_accepted_and_unpaid() -> None:
    accepted = {"accepted_at": "2030-01-10T12:00:00+00:00"}
    settings = {"deadline_hours": 72, "terms_version": "2026-11-01"}

    due_at = domain_policy.booking_payment_due_at(_booking(payment_status="unpaid", **accepted), **settings)
    pending = domain_policy.booking_payment_due_at(_booking(payment_status="pending", **accepted), **settings)
    paid = domain_policy.booking_payment_due_at(_booking(payment_status="paid", **accepted), **settings)
    cancelled = domain_policy.booking_payment_due_at(_booking(status="cancelled", **accepted), **settings)

    assert due_at == datetime(2030, 1, 13, 12, 0, tzinfo=UTC)
    assert pending == due_at
    assert (paid, cancelled) == (None, None)


def test_the_terms_version_is_read_as_a_date_or_not_at_all() -> None:
    assert domain_policy.terms_effective_date("2026-11-01") == date(2026, 11, 1)
    assert domain_policy.terms_effective_date("not-a-date") is None


# --- deposits -----------------------------------------------------------------------------------------------


def _deposit_booking(**columns: Any) -> BookingRow:
    """A paid GBP 50 deposit booking for 1 June 2030: claims open that day, deposit due back 9 June 00:00."""
    columns.setdefault("payment_status", "paid")
    return _booking(damage_deposit_gbp=50.0, paid_at="2030-05-01T09:00:00+00:00", **columns)


def test_a_deposit_goes_back_seven_days_after_the_last_event_day() -> None:
    assert domain_policy.deposit_pence(_deposit_booking()) == 5000
    assert domain_policy.deposit_refund_due_at(_deposit_booking()) == datetime(2030, 6, 9, tzinfo=UTC)
    multi_day = _deposit_booking(event_end_date="2030-06-03")
    assert domain_policy.deposit_refund_due_at(multi_day) == datetime(2030, 6, 11, tzinfo=UTC)
    assert domain_policy.deposit_refund_due_at(_booking()) is None


def test_the_claim_window_runs_from_the_first_event_day_to_the_refund_moment() -> None:
    booking = _deposit_booking()

    assert not domain_policy.deposit_claim_open(booking, datetime(2030, 5, 31, 23, 59, tzinfo=UTC))
    assert domain_policy.deposit_claim_open(booking, datetime(2030, 6, 1, 0, 0, tzinfo=UTC))
    assert domain_policy.deposit_claim_open(booking, datetime(2030, 6, 8, 23, 59, tzinfo=UTC))
    assert not domain_policy.deposit_claim_open(booking, datetime(2030, 6, 9, 0, 0, tzinfo=UTC))


def test_a_claimed_or_resolved_or_refunded_deposit_is_not_claimable_or_auto_refunded() -> None:
    after_window = datetime(2030, 6, 10, tzinfo=UTC)
    during_window = datetime(2030, 6, 3, tzinfo=UTC)

    assert domain_policy.deposit_refund_due(_deposit_booking(), after_window)
    assert not domain_policy.deposit_refund_due(_deposit_booking(), datetime(2030, 6, 8, 23, 59, tzinfo=UTC))
    claimed = _deposit_booking(deposit_claimed_at="2030-06-02T10:00:00+00:00")
    assert not domain_policy.deposit_refund_due(claimed, after_window)
    assert not domain_policy.deposit_claim_open(claimed, during_window)
    refunded = _deposit_booking(deposit_refunded_at="2030-06-09T01:00:00+00:00")
    assert not domain_policy.deposit_still_held(refunded)
    assert not domain_policy.deposit_claim_open(refunded, during_window)
    resolved = _deposit_booking(deposit_claim_resolved_at="2030-06-04T10:00:00+00:00")
    assert not domain_policy.deposit_still_held(resolved)
    unpaid = _booking(damage_deposit_gbp=50.0)
    assert not domain_policy.deposit_refund_due(unpaid, after_window)


# --- staff partial refunds ----------------------------------------------------------------------------------


def test_a_staff_partial_refund_is_capped_at_the_payment_less_deposit_and_upfront() -> None:
    plain = _booking(payment_amount_gbp=157.5)
    with_held_deposit = _booking(payment_amount_gbp=207.5, damage_deposit_gbp=50.0)
    with_returned_deposit = _booking(
        payment_amount_gbp=207.5, damage_deposit_gbp=50.0, deposit_refunded_at="2030-06-09T01:00:00+00:00"
    )
    with_upfront_paid = _booking(
        payment_amount_gbp=157.5, upfront_amount_gbp=105.0, upfront_payout_at="2030-06-02T10:00:00+00:00"
    )
    with_both = _booking(
        payment_amount_gbp=207.5,
        damage_deposit_gbp=50.0,
        upfront_amount_gbp=105.0,
        upfront_payout_at="2030-06-02T10:00:00+00:00",
    )

    assert domain_policy.staff_refundable_pence(plain) == 15750
    assert domain_policy.staff_refundable_pence(with_held_deposit) == 15750
    # The returned deposit already went back as its own refund: it is never refunded twice.
    assert domain_policy.staff_refundable_pence(with_returned_deposit) == 15750
    assert domain_policy.staff_refundable_pence(with_upfront_paid) == 5250
    assert domain_policy.staff_refundable_pence(with_both) == 5250
    assert domain_policy.staff_refundable_pence(_booking()) == 0


def test_a_deposit_is_not_held_once_the_payment_itself_was_refunded() -> None:
    assert domain_policy.deposit_still_held(_deposit_booking())
    assert not domain_policy.deposit_still_held(_deposit_booking(payment_status="refunded"))
    assert not domain_policy.deposit_still_held(_deposit_booking(payment_status="unpaid"))


# --- the vendor's profile options ---------------------------------------------------------------------------


def _step_four(**options: Any) -> dict[str, Any]:
    """A pricing-step payload with a valid hourly rate plus the Terms options under test."""
    return {"hourlyRate": "50", **options}


def test_profile_accepts_a_valid_split_and_deposit_and_their_boundaries() -> None:
    validate_step_fields(4, _step_four())
    validate_step_fields(4, _step_four(deliveryUpfrontPercent="70", deliveryDeadlineDays="14"))
    validate_step_fields(4, _step_four(deliveryUpfrontPercent="50", deliveryDeadlineDays="1"))
    validate_step_fields(4, _step_four(deliveryUpfrontPercent=80, deliveryDeadlineDays=60))
    validate_step_fields(4, _step_four(damageDepositGbp="0"))
    validate_step_fields(4, _step_four(damageDepositGbp="1000"))
    validate_step_fields(4, _step_four(damageDepositGbp="250.50"))


@pytest.mark.parametrize(
    ("options", "message"),
    [
        (
            {"deliveryUpfrontPercent": "49", "deliveryDeadlineDays": "14"},
            "Paid after the event (%) must be a whole number from 50 to 80.",
        ),
        (
            {"deliveryUpfrontPercent": "81", "deliveryDeadlineDays": "14"},
            "Paid after the event (%) must be a whole number from 50 to 80.",
        ),
        (
            {"deliveryUpfrontPercent": "70.5", "deliveryDeadlineDays": "14"},
            "Paid after the event (%) must be a whole number from 50 to 80.",
        ),
        (
            {"deliveryUpfrontPercent": "70", "deliveryDeadlineDays": "0"},
            "Days to deliver must be a whole number from 1 to 60.",
        ),
        (
            {"deliveryUpfrontPercent": "70", "deliveryDeadlineDays": "61"},
            "Days to deliver must be a whole number from 1 to 60.",
        ),
        (
            {"deliveryUpfrontPercent": "70"},
            "Set both the part paid after the event and the days to deliver, or neither.",
        ),
        (
            {"deliveryDeadlineDays": "14"},
            "Set both the part paid after the event and the days to deliver, or neither.",
        ),
        ({"damageDepositGbp": "1000.01"}, "Damage deposit must be an amount from £0 to £1000."),
        ({"damageDepositGbp": "abc"}, "Damage deposit must be an amount from £0 to £1000."),
    ],
)
def test_profile_rejects_out_of_range_or_half_filled_terms_options(
    options: dict[str, str], message: str
) -> None:
    with pytest.raises(ProfileInvalid) as raised:
        validate_step_fields(4, _step_four(**options))

    assert raised.value.message == message
