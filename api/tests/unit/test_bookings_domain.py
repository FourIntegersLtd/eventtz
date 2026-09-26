"""Booking rules with no I/O: completion timing, cancelling, quote lines, surcharges and capacity."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from app.features.bookings import domain
from app.features.bookings.errors import (
    AdjustmentAmountInvalid,
    BookingAlreadyRefunded,
    CancelAfterPayout,
    CancelCompleteInstead,
    CancelPartialRefund,
    EventSpanTooLong,
    QuoteLineInvalid,
    QuoteLineNeedsPrice,
    QuoteNeedsLineItem,
    SurchargeTooHigh,
    VendorFullOnDate,
)
from app.features.bookings.rows import BookingRow


def _booking(**overrides: object) -> BookingRow:
    """A paid, accepted one-day booking on 1 June 2099, with `overrides` applied."""
    values: dict[str, object] = {
        "id": "booking-1",
        "client_user_id": "client-1",
        "vendor_user_id": "vendor-1",
        "status": "accepted",
        "payment_status": "paid",
        "event_date": "2099-06-01",
    }
    values.update(overrides)
    return BookingRow.model_validate(values)


def test_the_event_day_is_over_at_utc_midnight_after_its_last_day() -> None:
    """A multi-day event ends after its last day, not its first."""
    booking = _booking(event_end_date="2099-06-03")
    assert not domain.event_day_over(booking, datetime(2099, 6, 3, 23, 59, tzinfo=UTC))
    assert domain.event_day_over(booking, datetime(2099, 6, 4, 0, 0, tzinfo=UTC))
    assert not domain.event_day_over(_booking(event_date="not a date"), datetime(2100, 1, 1, tzinfo=UTC))


def test_the_payout_releases_automatically_only_for_paid_accepted_bookings() -> None:
    """The release time is the end of the event plus the configured hours."""
    assert domain.payout_auto_release_at(_booking(), hours_after_event=48) == datetime(
        2099, 6, 4, 0, 0, tzinfo=UTC
    )
    assert domain.payout_auto_release_at(_booking(payment_status="unpaid"), hours_after_event=48) is None
    assert domain.payout_auto_release_at(_booking(status="completed"), hours_after_event=48) is None


def test_completion_waits_on_whoever_has_not_confirmed() -> None:
    """Both, then the other party, then nobody."""
    stamp = "2099-06-02T10:00:00+00:00"
    assert domain.completion_waiting_on(_booking()) == "both"
    assert domain.completion_waiting_on(_booking(client_completion_confirmed_at=stamp)) == "vendor"
    assert domain.completion_waiting_on(_booking(vendor_completion_confirmed_at=stamp)) == "client"
    both_confirmed = _booking(client_completion_confirmed_at=stamp, vendor_completion_confirmed_at=stamp)
    assert domain.completion_waiting_on(both_confirmed) is None
    assert domain.completion_waiting_on(_booking(payment_status="unpaid")) is None


def test_the_completion_result_says_when_the_other_party_is_still_to_confirm() -> None:
    """One confirmation on an accepted booking is awaiting the other; a completed one is not."""
    stamp = "2099-06-02T10:00:00+00:00"
    assert domain.completion_result(_booking(client_completion_confirmed_at=stamp)) == {
        "id": "booking-1",
        "status": "accepted",
        "payment_status": "paid",
        "awaiting_other_party": True,
    }
    completed = _booking(status="completed", client_completion_confirmed_at=stamp)
    assert domain.completion_result(completed)["awaiting_other_party"] is False
    assert domain.completion_result(_booking())["awaiting_other_party"] is False


def test_contact_details_show_only_once_paid_and_accepted_or_completed() -> None:
    """Paying unlocks contact; a cancelled booking hides it again."""
    assert domain.contact_visible(_booking())
    assert domain.contact_visible(_booking(status="completed", payment_status="payout_released"))
    assert not domain.contact_visible(_booking(payment_status="pending"))
    assert not domain.contact_visible(_booking(status="cancelled"))


@pytest.mark.parametrize(
    ("status", "payment_status", "error"),
    [
        ("completed", "paid", CancelCompleteInstead),
        ("accepted", "payout_released", CancelAfterPayout),
        ("accepted", "partially_refunded", CancelPartialRefund),
        ("pending", "refunded", BookingAlreadyRefunded),
    ],
)
def test_cancelling_is_refused_once_money_has_moved(
    status: str, payment_status: str, error: type[Exception]
) -> None:
    """Each money state that forbids a cancel has its own error."""
    with pytest.raises(error):
        domain.check_cancel_money_state(status=status, payment_status=payment_status)


def test_cancelling_is_allowed_before_money_has_moved() -> None:
    """Unpaid bookings, and a refunded accepted one, may still be cancelled here."""
    domain.check_cancel_money_state(status="pending", payment_status="unpaid")
    domain.check_cancel_money_state(status="accepted", payment_status="paid")
    domain.check_cancel_money_state(status="accepted", payment_status="refunded")


def test_a_price_change_needs_confirming_only_on_a_pending_client_request() -> None:
    """Vendor quotes and requests without adjustments go straight through."""
    adjustments = [{"id": "adjustment-1", "tag": "travel", "label": "Travel", "amount_gbp": 20}]
    assert domain.price_confirmation_required(_booking(status="pending", vendor_adjustments=adjustments))
    assert not domain.price_confirmation_required(
        _booking(status="pending", initiator="vendor", vendor_adjustments=adjustments)
    )
    assert not domain.price_confirmation_required(_booking(status="pending"))
    assert not domain.price_confirmation_required(_booking(vendor_adjustments=adjustments))


def test_quote_lines_are_trimmed_and_rounded_to_pence() -> None:
    """Headings are stripped; prices keep two decimal places."""
    assert domain.validated_quote_lines([{"heading": "  DJ set  ", "unit_price_gbp": "150.456"}]) == [
        {"heading": "DJ set", "unit_price_gbp": 150.46}
    ]


@pytest.mark.parametrize(
    ("line_items", "error"),
    [
        ([], QuoteNeedsLineItem),
        ([{"heading": "", "unit_price_gbp": 10}], QuoteLineInvalid),
        ([{"heading": "DJ"}], QuoteLineNeedsPrice),
        ([{"heading": "DJ", "unit_price_gbp": "ten"}], QuoteLineInvalid),
        ([{"heading": "DJ", "unit_price_gbp": 0}], QuoteLineInvalid),
        ([{"heading": "DJ", "unit_price_gbp": "nan"}], QuoteLineInvalid),
        ([{"heading": "DJ", "unit_price_gbp": 10}] * 26, QuoteLineInvalid),
    ],
)
def test_bad_quote_lines_are_refused(line_items: list[dict[str, object]], error: type[Exception]) -> None:
    """Missing, unpriced, non-numeric, zero or too many lines each raise."""
    with pytest.raises(error):
        domain.validated_quote_lines(line_items)


def test_adjustments_drop_zero_amounts_and_default_their_text() -> None:
    """A zero line is ignored; a blank label and tag get defaults; amounts round to pence."""
    stored = domain.built_adjustments(
        [{"amount_gbp": 0, "label": "Nothing"}, {"amount_gbp": "-12.345", "label": " ", "tag": ""}]
    )
    assert [(item["tag"], item["label"], item["amount_gbp"]) for item in stored] == [
        ("other", "Additional cost", -12.35)
    ]
    with pytest.raises(AdjustmentAmountInvalid):
        domain.built_adjustments([{"amount_gbp": "lots"}])


def test_surcharges_are_capped_singly_and_as_a_share_of_the_packages() -> None:
    """One surcharge over the single cap, or all of them over the percentage, raises."""
    line_items = [{"unit_price_gbp": 100}]
    domain.check_surcharge_caps(
        line_items, [{"amount_gbp": 50.0}, {"amount_gbp": -500.0}], max_single_gbp=500, max_percent=50
    )
    with pytest.raises(SurchargeTooHigh, match="Each surcharge cannot exceed GBP 500"):
        domain.check_surcharge_caps(line_items, [{"amount_gbp": 501.0}], max_single_gbp=500, max_percent=1000)
    with pytest.raises(SurchargeTooHigh, match="cannot exceed 50% of the quoted line items"):
        domain.check_surcharge_caps(line_items, [{"amount_gbp": 51.0}], max_single_gbp=500, max_percent=50)


def test_event_days_list_every_day_and_refuse_over_a_year() -> None:
    """A three-day event is three days; a span over 366 days raises."""
    assert domain.event_days(date(2099, 6, 1), None) == ["2099-06-01"]
    assert domain.event_days(date(2099, 6, 1), date(2099, 6, 3)) == ["2099-06-01", "2099-06-02", "2099-06-03"]
    with pytest.raises(EventSpanTooLong):
        domain.event_days(date(2099, 1, 1), date(2100, 1, 3))


def test_the_daily_cap_defaults_to_one_and_is_clamped() -> None:
    """Unset is one booking a day; the profile's value is kept between 1 and 20."""
    assert domain.daily_cap(None) == 1
    assert domain.daily_cap(0) == 1
    assert domain.daily_cap(3.7) == 3
    assert domain.daily_cap(99) == 20


def test_a_day_at_the_cap_is_full_and_multi_day_bookings_count_on_each_day() -> None:
    """The first full day is named in the message."""
    open_bookings = [("2099-06-01", "2099-06-03"), ("2099-06-05", None)]
    domain.check_daily_capacity(["2099-06-04"], open_bookings, cap=1)
    with pytest.raises(VendorFullOnDate) as raised:
        domain.check_daily_capacity(["2099-06-04", "2099-06-02"], open_bookings, cap=1)
    assert raised.value.message == (
        "This vendor already has the maximum number of bookings (1) on 2099-06-02. "
        "Choose another date or contact the vendor."
    )


def test_the_capacity_trigger_message_becomes_the_friendly_error() -> None:
    """The trigger's `marker:day:cap` text is parsed; other database errors are not mapped."""
    mapped = domain.capacity_error_from_db("vendor_daily_capacity_exceeded:2099-06-01:2 (context)")
    assert mapped is not None
    assert "maximum number of bookings (2) on 2099-06-01" in mapped.message
    assert domain.capacity_error_from_db("duplicate key value violates unique constraint") is None
