"""Pure rules for what a client gets back when they cancel a paid booking.

A vendor picks one of three presets (the keys are also listed in
`vendors/domain_profile_form.py`, which stores the vendor's choice; a unit test keeps
the two lists equal). Each preset is a sliding scale by days before the event, the
shape the CMA expects of event cancellation terms and the one Airbnb, Peerspace and
Tagvenue use. Two rules sit above every preset:

- a cooling-off window: a client who cancels within `COOLING_OFF_HOURS` of paying,
  with the event still at least `COOLING_OFF_MIN_DAYS_BEFORE_EVENT` days away, is
  refunded in full;
- the Eventtz service fee is always refunded; only the vendor's price is tiered.

A booking with no policy snapshot follows the default preset. Money is integer pence
here; the services format it at the edge.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.core.time import uk_date
from app.features.bookings.domain_payments import gbp_to_pence, parse_event_date
from app.features.bookings.rows import BookingRow

FLEXIBLE = "flexible"
MODERATE = "moderate"
STRICT = "strict"
DEFAULT_PRESET = FLEXIBLE

# Each tier is (at least this many days before the event, percent of the vendor's price refunded);
# the first tier whose day threshold the cancel meets applies, so a preset ends in a 0-day row.
PRESET_TIERS: dict[str, tuple[tuple[int, int], ...]] = {
    FLEXIBLE: ((7, 100), (2, 50), (0, 0)),
    MODERATE: ((30, 100), (7, 50), (0, 0)),
    STRICT: ((90, 100), (60, 75), (30, 50), (0, 0)),
}
PRESET_KEYS = tuple(PRESET_TIERS)
PRESET_LABELS = {FLEXIBLE: "Flexible", MODERATE: "Moderate", STRICT: "Strict"}

COOLING_OFF_HOURS = 24
COOLING_OFF_MIN_DAYS_BEFORE_EVENT = 7


@dataclass(frozen=True)
class CancellationSettlement:
    """How a paid booking's money is split when the client cancels."""

    policy: str
    refund_percent: int
    refund_pence: int
    vendor_share_pence: int
    cooling_off: bool

    @property
    def full_refund(self) -> bool:
        """True when the client gets everything back, so the plain full-refund path applies."""
        return self.vendor_share_pence == 0


def normalize_preset(raw_preset: str | None) -> str:
    """The preset key a vendor stored, or the default for anything unknown."""
    key = (raw_preset or "").strip().lower()
    return key if key in PRESET_TIERS else DEFAULT_PRESET


def preset_label(preset: str | None) -> str:
    """The preset's name as shown to people, for a stored key (an unknown one reads as the default)."""
    return PRESET_LABELS[normalize_preset(preset)]


def describe_preset(preset: str) -> list[str]:
    """Plain-language lines for a preset, one per tier, the same in the UI, receipts, emails and Terms."""
    lines: list[str] = []
    tiers = PRESET_TIERS[normalize_preset(preset)]
    for tier_index, (min_days, percent) in enumerate(tiers):
        upper_days = tiers[tier_index - 1][0] if tier_index > 0 else None
        if upper_days is None:
            window = f"{min_days} or more days before the event"
        elif min_days == 0:
            window = f"less than {upper_days} days before the event"
        else:
            window = f"{min_days} to {upper_days - 1} days before the event"
        outcome = {100: "full refund", 0: "no refund"}.get(percent, f"{percent}% refund")
        lines.append(f"{window[0].upper()}{window[1:]}: {outcome} of the vendor's price")
    lines.append(
        f"Within {COOLING_OFF_HOURS} hours of paying, if the event is at least "
        f"{COOLING_OFF_MIN_DAYS_BEFORE_EVENT} days away: full refund"
    )
    lines.append("The Eventtz service fee is always refunded")
    return lines


def tier_percent(preset: str, days_before_event: int) -> int:
    """The percent of the vendor's price refunded `days_before_event` days out under the preset."""
    for min_days, percent in PRESET_TIERS[normalize_preset(preset)]:
        if days_before_event >= min_days:
            return percent
    return 0


def days_before_event(booking: BookingRow, now: datetime) -> int | None:
    """Whole days from today (London) to the event's first day; negative once it has started.

    Event dates are UK calendar dates, so "today" is the London day: a cancel at 23:30 UTC in summer
    is already tomorrow for the client.
    """
    event_day = parse_event_date(booking.event_date)
    if event_day is None:
        return None
    return (event_day - uk_date(now)).days


def in_cooling_off(booking: BookingRow, now: datetime) -> bool:
    """True while the client may still change their mind for free: paid recently, event far enough away."""
    paid_at = _parse_timestamp(booking.paid_at)
    days_out = days_before_event(booking, now)
    if paid_at is None or days_out is None:
        return False
    recently_paid = now - paid_at <= timedelta(hours=COOLING_OFF_HOURS)
    return recently_paid and days_out >= COOLING_OFF_MIN_DAYS_BEFORE_EVENT


def cooling_off_until(booking: BookingRow) -> datetime | None:
    """When the cooling-off window closes (24h after payment), or None for an unpaid booking."""
    paid_at = _parse_timestamp(booking.paid_at)
    return paid_at + timedelta(hours=COOLING_OFF_HOURS) if paid_at is not None else None


def refund_percent(booking: BookingRow, now: datetime) -> tuple[int, bool]:
    """The percent of the vendor's price the client gets back, and whether cooling-off decided it."""
    if in_cooling_off(booking, now):
        return 100, True
    days_out = days_before_event(booking, now)
    if days_out is None:
        return 100, False
    return tier_percent(normalize_preset(booking.cancellation_policy), days_out), False


def settlement(booking: BookingRow, now: datetime) -> CancellationSettlement:
    """The refund and vendor share for a client cancel now, in pence, from the snapshot taken at payment."""
    percent, cooling_off = refund_percent(booking, now)
    paid_pence = gbp_to_pence(booking.payment_amount_gbp or 0.0)
    vendor_pence = min(gbp_to_pence(booking.vendor_amount_gbp or 0.0), paid_pence)
    # Everything the client paid above the vendor's price (the service fee, net of any referral
    # discount) always comes back; the tier applies to the vendor's price alone.
    non_vendor_pence = paid_pence - vendor_pence
    refunded_vendor_pence = int(round(vendor_pence * percent / 100))
    return CancellationSettlement(
        policy=normalize_preset(booking.cancellation_policy),
        refund_percent=percent,
        refund_pence=non_vendor_pence + refunded_vendor_pence,
        vendor_share_pence=vendor_pence - refunded_vendor_pence,
        cooling_off=cooling_off,
    )


def next_tier_change(booking: BookingRow, now: datetime) -> tuple[date, int] | None:
    """The next day the refund percent drops, and what it drops to; None when it cannot drop further."""
    preset = normalize_preset(booking.cancellation_policy)
    days_out = days_before_event(booking, now)
    event_day = parse_event_date(booking.event_date)
    if days_out is None or event_day is None:
        return None
    current = tier_percent(preset, days_out)
    for min_days, percent in PRESET_TIERS[preset]:
        # The first tier below today's: it starts the day the count drops under the tier above it.
        if percent < current and days_out >= min_days:
            return event_day - timedelta(days=_tier_above(preset, min_days) - 1), percent
    return None


def _tier_above(preset: str, min_days: int) -> int:
    """The day threshold of the tier just above the one starting at `min_days`."""
    tiers = PRESET_TIERS[normalize_preset(preset)]
    for tier_index, (threshold, _percent) in enumerate(tiers):
        if threshold == min_days and tier_index > 0:
            return tiers[tier_index - 1][0]
    return min_days


def _parse_timestamp(value: str | None) -> datetime | None:
    """An ISO timestamp as the rows carry it (UTC assumed when naive), or None."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
