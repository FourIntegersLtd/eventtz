"""The numbers behind the Terms of Service rules the bookings slice enforces.

Each one is printed in the Terms through `web/lib/policyConstants.json`; a unit test
(`tests/unit/test_policy_constants.py`) keeps that file equal to these constants and to
the settings defaults, so the legal copy can never promise a number the code does not use.
Pure values and small rules only: no database, no network.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal

from app.core.time import london_midnight_utc
from app.features.bookings.rows import BookingRow

# Where a split-payout booking is in its payout: `full` (no split), `upfront` (nothing paid yet),
# `waiting_delivery` (first part paid, photos not delivered), `final` (the rest is due now).
PayoutStage = Literal["full", "upfront", "waiting_delivery", "final"]

# --- after the event: how long the client has to report a problem ------------------------------------

# Categories whose vendors collect equipment after the event get a longer window before payout,
# so a client has time to notice a problem with a collection. Others use the settings default.
REPORT_WINDOW_HOURS_BY_CATEGORY: dict[str, int] = {"rentals": 96, "decor": 96}

# --- photography: part on completion, the rest once the photos are delivered -------------------------

# Compulsory for these categories: paying in full before the photos exist left the client with
# nothing held back if they never arrived. The vendor may tune the numbers inside the ranges.
DELIVERY_SPLIT_CATEGORIES: frozenset[str] = frozenset({"photography"})
DELIVERY_UPFRONT_PERCENT_MIN = 50
DELIVERY_UPFRONT_PERCENT_MAX = 60
DELIVERY_DEADLINE_DAYS_MAX = 60
# Used when the vendor left a number blank or it is out of range.
DEFAULT_DELIVERY_UPFRONT_PERCENT = 60
DEFAULT_DELIVERY_DEADLINE_DAYS = 30

# --- damage deposits ---------------------------------------------------------------------------------

DEPOSIT_CATEGORIES: frozenset[str] = frozenset({"rentals", "decor"})
DEPOSIT_MAX_GBP = 1000
# Days after the event's last day the vendor has to claim; then the deposit goes back by itself.
DEPOSIT_CLAIM_DAYS = 7
# Payment statuses in which a paid deposit can still be with Eventtz.
DEPOSIT_HOLDING_PAYMENT_STATUSES = frozenset({"paid", "payout_released", "partially_refunded"})
# A payment deadline never falls later than this many hours before the event starts (Terms section 3).
PAYMENT_DEADLINE_HOURS_BEFORE_EVENT = 48

# --- vendor cancellations (private staff record) -----------------------------------------------------

# Staff review a vendor who cancels this many paid bookings within the window (Terms: warning first).
VENDOR_CANCELLATION_REVIEW_COUNT = 2
VENDOR_CANCELLATION_REVIEW_DAYS = 180


def cancellation_review_flag(cancellation_count: int) -> bool:
    """True when a vendor's recent cancellation count reaches the staff-review threshold."""
    return cancellation_count >= VENDOR_CANCELLATION_REVIEW_COUNT


def report_window_hours(service_keys: Iterable[str], *, default_hours: int) -> int | None:
    """The reporting window to copy onto a booking: the longest of the vendor's categories.

    None when no category needs more than the default, so ordinary bookings keep a NULL
    column and follow the setting.
    """
    longest = max((REPORT_WINDOW_HOURS_BY_CATEGORY.get(key, 0) for key in service_keys), default=0)
    return longest if longest > default_hours else None


def payment_due_at(
    *,
    accepted_at: datetime | None,
    event_date: date | None,
    deadline_hours: int,
) -> datetime | None:
    """When an accepted booking must be paid by, or None when no deadline applies.

    The earlier of `deadline_hours` after acceptance and PAYMENT_DEADLINE_HOURS_BEFORE_EVENT
    before the start (London midnight of the event's first day, like the delivery and deposit
    clocks; hours are real elapsed hours). A booking accepted inside that
    window would otherwise be due before it was accepted, so it is due by the event start instead.
    """
    if accepted_at is None or event_date is None:
        return None
    accepted_utc = accepted_at.astimezone(UTC)
    # Subtract on the UTC value (see london_midnight_utc).
    event_start = london_midnight_utc(event_date)
    latest_due = event_start - timedelta(hours=PAYMENT_DEADLINE_HOURS_BEFORE_EVENT)
    if latest_due <= accepted_utc:
        latest_due = event_start
    return min(accepted_utc + timedelta(hours=deadline_hours), latest_due)


# --- split payouts, deposits: what a booking carries from the vendor's profile ------------------------


def _service_keys(vendor_payload: dict[str, Any]) -> list[str]:
    """The vendor's category keys from their profile payload (`servicesOffered`)."""
    raw_services = vendor_payload.get("servicesOffered")
    if not isinstance(raw_services, list):
        return []
    return [str(service_key).strip().lower() for service_key in raw_services if isinstance(service_key, str)]


def _whole_number(raw_value: Any) -> int | None:
    """A whole number from a payload value (an int, or a float/str holding one); None otherwise."""
    if isinstance(raw_value, bool):
        return None
    try:
        number = float(raw_value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else None


def delivery_split_terms(vendor_payload: dict[str, Any]) -> tuple[int, int] | None:
    """The vendor's (upfront percent, delivery deadline days), or None when no split applies.

    Only categories with work delivered after the event (photography) are split, and for them the
    split is never off: a blank or unusable number falls back to the default. A percent above the
    maximum (saved when the limit was 80) is capped rather than reset, as the vendor meant "a lot".
    """
    if not DELIVERY_SPLIT_CATEGORIES.intersection(_service_keys(vendor_payload)):
        return None
    upfront_percent = _whole_number(vendor_payload.get("deliveryUpfrontPercent"))
    deadline_days = _whole_number(vendor_payload.get("deliveryDeadlineDays"))
    if upfront_percent is not None and upfront_percent > DELIVERY_UPFRONT_PERCENT_MAX:
        upfront_percent = DELIVERY_UPFRONT_PERCENT_MAX
    if upfront_percent is None or upfront_percent < DELIVERY_UPFRONT_PERCENT_MIN:
        upfront_percent = DEFAULT_DELIVERY_UPFRONT_PERCENT
    if deadline_days is None or not 1 <= deadline_days <= DELIVERY_DEADLINE_DAYS_MAX:
        deadline_days = DEFAULT_DELIVERY_DEADLINE_DAYS
    return upfront_percent, deadline_days


def damage_deposit_pence(vendor_payload: dict[str, Any]) -> int:
    """The refundable deposit the vendor asks for, in pence; 0 when none applies.

    Only rentals and decor vendors may take one, up to `DEPOSIT_MAX_GBP`; a larger or
    unreadable value counts as none rather than being trimmed, so the client is never
    charged a number the vendor did not set.
    """
    if not DEPOSIT_CATEGORIES.intersection(_service_keys(vendor_payload)):
        return 0
    raw_deposit = vendor_payload.get("damageDepositGbp")
    if isinstance(raw_deposit, bool) or not isinstance(raw_deposit, (int, float, str)):
        return 0
    try:
        deposit_gbp = float(raw_deposit)
    except (TypeError, ValueError):
        return 0
    if deposit_gbp <= 0 or deposit_gbp > DEPOSIT_MAX_GBP:
        return 0
    return int(round(deposit_gbp * 100))


def checkout_terms_columns(vendor_payload: dict[str, Any], *, default_report_hours: int) -> dict[str, Any]:
    """The Terms rules copied onto a booking at checkout, so later profile edits never change them."""
    split_terms = delivery_split_terms(vendor_payload)
    deposit_pence = damage_deposit_pence(vendor_payload)
    return {
        "report_window_hours": report_window_hours(
            _service_keys(vendor_payload), default_hours=default_report_hours
        ),
        "payout_upfront_percent": split_terms[0] if split_terms else None,
        "delivery_deadline_days": split_terms[1] if split_terms else None,
        "damage_deposit_gbp": deposit_pence / 100 if deposit_pence else None,
    }


def upfront_pence(vendor_pence: int, upfront_percent: int) -> int:
    """The first part of a split payout, in pence: the percent of the vendor's price, rounded half up."""
    return (vendor_pence * upfront_percent + 50) // 100


def _parse_instant(raw_value: str | None) -> datetime | None:
    """An ISO timestamp from a row as an aware UTC datetime; None when blank or unreadable."""
    if not raw_value:
        return None
    try:
        parsed = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def event_over_at(booking: BookingRow, *, plus_days: int = 0) -> datetime | None:
    """The UTC instant of London midnight ending the event's last day, `plus_days` days later.

    Whole London calendar days are added before taking midnight, so a window that crosses a clock
    change still ends at London midnight. None for a bad date.
    """
    last_day = (booking.event_end_date or booking.event_date or "")[:10]
    try:
        event_day = date.fromisoformat(last_day)
    except ValueError:
        return None
    clock_day = event_day + timedelta(days=1 + plus_days)
    return london_midnight_utc(clock_day)


def delivery_due_at(booking: BookingRow) -> datetime | None:
    """When the rest of a split payout is released even without the client confirming delivery."""
    if not booking.payout_upfront_percent or not booking.delivery_deadline_days:
        return None
    return event_over_at(booking, plus_days=booking.delivery_deadline_days)


def payout_stage(booking: BookingRow, now: datetime) -> PayoutStage:
    """Which payout a release of this booking makes now (see `PayoutStage`)."""
    if not booking.payout_upfront_percent:
        return "full"
    if not booking.upfront_payout_at:
        return "upfront"
    if booking.delivery_confirmed_at:
        return "final"
    due_at = delivery_due_at(booking)
    return "final" if due_at is not None and now >= due_at else "waiting_delivery"


def held_upfront_pence(booking: BookingRow) -> int:
    """The part of the vendor's price already paid out as a split's first part (0 when none)."""
    if not booking.upfront_payout_at:
        return 0
    return int(round((booking.upfront_amount_gbp or 0.0) * 100))


def deposit_pence(booking: BookingRow) -> int:
    """The deposit the client paid on this booking, in pence."""
    return int(round((booking.damage_deposit_gbp or 0.0) * 100))


def deposit_refund_due_at(booking: BookingRow) -> datetime | None:
    """When an unclaimed deposit goes back to the client: `DEPOSIT_CLAIM_DAYS` after the event's last day."""
    if deposit_pence(booking) <= 0:
        return None
    return event_over_at(booking, plus_days=DEPOSIT_CLAIM_DAYS)


def deposit_still_held(booking: BookingRow) -> bool:
    """True while Eventtz holds the deposit: paid, not refunded, and no claim resolved.

    A booking refunded in full or lost to a chargeback no longer holds anything, whatever the
    deposit columns say, so `payment_status` must still be one where the money is with Eventtz.
    """
    return (
        deposit_pence(booking) > 0
        and booking.paid_at is not None
        and booking.payment_status in DEPOSIT_HOLDING_PAYMENT_STATUSES
        and booking.deposit_refunded_at is None
        and booking.deposit_claim_resolved_at is None
    )


def deposit_refund_due(booking: BookingRow, now: datetime) -> bool:
    """True when the deposit should go back by itself: held, unclaimed, and the claim window has ended."""
    due_at = deposit_refund_due_at(booking)
    return (
        deposit_still_held(booking)
        and booking.deposit_claimed_at is None
        and due_at is not None
        and now >= due_at
    )


def deposit_claim_open(booking: BookingRow, now: datetime) -> bool:
    """True while the vendor may claim the deposit: from the event's first day until the window ends."""
    due_at = deposit_refund_due_at(booking)
    first_day = (booking.event_date or "")[:10]
    try:
        event_start = london_midnight_utc(date.fromisoformat(first_day))
    except ValueError:
        return False
    return (
        deposit_still_held(booking)
        and booking.deposit_claimed_at is None
        and due_at is not None
        and event_start <= now < due_at
    )


def staff_refundable_pence(booking: BookingRow) -> int:
    """The most a staff partial refund may return: the payment, less the deposit and any upfront payout.

    The deposit always has its own path (back to the client, or to the vendor on a claim), held
    or already settled, and an upfront payout has already left Eventtz, so neither may be
    refunded again here.
    """
    paid_pence = int(round((booking.payment_amount_gbp or 0.0) * 100))
    return max(0, paid_pence - deposit_pence(booking) - held_upfront_pence(booking))


def booking_payment_due_at(booking: BookingRow, *, deadline_hours: int) -> datetime | None:
    """`payment_due_at` for a stored booking: only while it is accepted and not yet paid."""
    if booking.status != "accepted" or booking.payment_status not in ("unpaid", "pending"):
        return None
    try:
        event_day = date.fromisoformat((booking.event_date or "")[:10])
    except ValueError:
        return None
    return payment_due_at(
        accepted_at=_parse_instant(booking.accepted_at),
        event_date=event_day,
        deadline_hours=deadline_hours,
    )
