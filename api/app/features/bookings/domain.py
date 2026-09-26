"""Pure booking rules: completion timing, contact masking, quote lines, surcharges, capacity.

No database or network here. Services pass in stored rows and settings; these
functions decide. The rules and messages are the baseline's (`bookings/*.py`),
ported unchanged.
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal

from app.features.bookings.errors import (
    AdjustmentAmountInvalid,
    AdjustmentOutOfRange,
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

WaitingOn = Literal["client", "vendor", "both"]

# The live-update event both parties' screens get when a booking changes.
BOOKING_CHANGED = "booking_changed"

# Why a booking fell out of the funnel (analytics only; the booking's status says what happened).
FAILURE_VENDOR_UNAVAILABLE = "VENDOR_UNAVAILABLE"
FAILURE_CUSTOMER_CANCELLED = "CUSTOMER_CANCELLED"

# Payment states in which the parties may see each other's email and phone.
CONTACT_UNLOCKED_PAYMENT_STATUSES = frozenset({"paid", "payout_released", "partially_refunded"})

# The list `group` query parameter and the statuses each group shows.
LIST_GROUP_STATUSES: dict[str, tuple[str, ...] | None] = {
    "active": ("pending", "accepted"),
    "completed": ("completed",),
    "closed": ("completed", "declined", "cancelled"),
    "all": None,
}

# The longest event a booking may cover, in days between first and last day.
MAX_EVENT_SPAN_DAYS = 366
# The vendor's `maxBookingsPerDay` is clamped to this range (as the profile form allows).
MIN_BOOKINGS_PER_DAY = 1
MAX_BOOKINGS_PER_DAY = 20
# The Postgres trigger (migration 033) raises with this marker: `marker:day:cap`.
CAPACITY_DB_MARKER = "vendor_daily_capacity_exceeded"

MAX_QUOTE_LINES = 25
MIN_QUOTE_LINE_PRICE_GBP = 0.01
MAX_LINE_PRICE_GBP = 1_000_000.0
MAX_ADJUSTMENTS = 20
ADJUSTMENT_LIMIT_GBP = 1_000_000.0
MAX_REVIEW_IMAGES = 5


# --- completion --------------------------------------------------------------------------------------


def _event_day_end_utc(booking: BookingRow) -> datetime | None:
    """UTC midnight at the start of the day after the event's last day, or `None` for a bad date."""
    last_day = (booking.event_end_date or booking.event_date or "")[:10]
    try:
        event_day = datetime.strptime(last_day, "%Y-%m-%d").replace(tzinfo=UTC)
    except ValueError:
        return None
    return event_day + timedelta(days=1)


def payout_auto_release_at(booking: BookingRow, *, hours_after_event: float) -> datetime | None:
    """When the held payment is released to the vendor without both confirmations, if it will be."""
    if booking.status != "accepted" or booking.payment_status != "paid":
        return None
    day_end = _event_day_end_utc(booking)
    return day_end + timedelta(hours=hours_after_event) if day_end is not None else None


def event_day_over(booking: BookingRow, now: datetime) -> bool:
    """True once the event's last day has ended (UTC)."""
    day_end = _event_day_end_utc(booking)
    return day_end is not None and now >= day_end


def completion_waiting_on(booking: BookingRow) -> WaitingOn | None:
    """Who still has to confirm the event went ahead; `None` when nobody (or not applicable)."""
    if booking.status != "accepted" or booking.payment_status != "paid":
        return None
    client_done = bool(booking.client_completion_confirmed_at)
    vendor_done = bool(booking.vendor_completion_confirmed_at)
    if client_done and vendor_done:
        return None
    if not client_done and not vendor_done:
        return "both"
    return "client" if not client_done else "vendor"


def completion_result(booking: BookingRow) -> dict[str, Any]:
    """The confirm-completion response: status, payment status and whether one side is still to confirm."""
    either_confirmed = bool(booking.client_completion_confirmed_at or booking.vendor_completion_confirmed_at)
    return {
        "id": booking.id,
        "status": booking.status,
        "payment_status": booking.payment_status,
        "awaiting_other_party": booking.status != "completed" and either_confirmed,
    }


# --- contact -----------------------------------------------------------------------------------------


def contact_unlocked(payment_status: str | None) -> bool:
    """True once the client has paid, so the parties may see each other's contact details."""
    return (payment_status or "unpaid") in CONTACT_UNLOCKED_PAYMENT_STATUSES


def contact_visible(booking: BookingRow) -> bool:
    """True when the booking is paid and accepted or completed, so contact details may be shown."""
    return contact_unlocked(booking.payment_status) and booking.status in ("accepted", "completed")


# --- cancelling --------------------------------------------------------------------------------------


def check_cancel_money_state(*, status: str, payment_status: str) -> None:
    """Refuse to cancel once the event is complete, the vendor is paid, or money went back already."""
    if status == "completed":
        raise CancelCompleteInstead()
    if payment_status == "payout_released":
        raise CancelAfterPayout()
    if payment_status == "partially_refunded":
        raise CancelPartialRefund()
    if payment_status == "refunded" and status != "accepted":
        raise BookingAlreadyRefunded()


# --- pricing confirmation and notification copy -------------------------------------------------------


def adjustment_dicts(raw_adjustments: object) -> list[dict[str, Any]]:
    """The stored adjustments that are objects; anything else in the list is ignored."""
    if not isinstance(raw_adjustments, list):
        return []
    return [adjustment for adjustment in raw_adjustments if isinstance(adjustment, dict)]


def price_confirmation_required(booking: BookingRow) -> bool:
    """True when the vendor changed the price of a pending client request and the client must agree."""
    if booking.status != "pending" or booking.initiator == "vendor":
        return False
    return len(adjustment_dicts(booking.vendor_adjustments)) > 0


def _signed_pounds(amount: float) -> str:
    """`£12.50` or `-£12.50`."""
    return f"£{amount:.2f}" if amount >= 0 else f"-£{abs(amount):.2f}"


def pricing_explanation_body(*, lead_sentence: str, total_label: str, adjustments: list[Any]) -> str:
    """Notification text: the lead line, what the total includes, and any vendor extras or discounts."""
    paragraphs = [
        lead_sentence.strip(),
        (
            "The total includes your selected packages or rates, any vendor additions or "
            f"discounts, and the Eventtz service fee.\n\nTotal due: {total_label}."
        ),
    ]
    extras: list[str] = []
    for adjustment in adjustment_dicts(adjustments):
        label = str(adjustment.get("label") or "Addition").strip()
        tag = str(adjustment.get("tag") or "other").strip()
        try:
            amount = float(adjustment.get("amount_gbp"))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        extras.append(f"{label} ({tag}): {_signed_pounds(amount)}")
    if extras:
        paragraphs.append("Vendor adjustments: " + "; ".join(extras) + ".")
    paragraphs.append("Please review the details on Eventtz and pay when you are ready.")
    return "\n\n".join(paragraphs)


def initial_total_label(
    booking: BookingRow, *, initial_client_total_label: str, current_client_total_label: str
) -> str:
    """The client total before the vendor's changes, as the booking screens show it.

    With adjustments on the booking this is the re-priced original; otherwise the stored
    label, falling back to today's total and then the persisted total label.
    """
    if adjustment_dicts(booking.vendor_adjustments):
        return initial_client_total_label
    stored = (booking.initial_client_total_label or "").strip()
    return stored or current_client_total_label or booking.total_label


# --- quotes ------------------------------------------------------------------------------------------


def validated_quote_lines(line_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The vendor's quote lines with prices rounded to pence and headings capped; raise on a bad line."""
    if not line_items:
        raise QuoteNeedsLineItem()
    if len(line_items) > MAX_QUOTE_LINES:
        raise QuoteLineInvalid(f"A quote cannot have more than {MAX_QUOTE_LINES} line items.")
    checked: list[dict[str, Any]] = []
    for raw_line in line_items:
        line = dict(raw_line)
        heading = str(line.get("heading") or "").strip()
        if not heading:
            raise QuoteLineInvalid("Each line item needs a heading.")
        raw_price = line.get("unit_price_gbp")
        if raw_price is None:
            raise QuoteLineNeedsPrice()
        try:
            price = float(raw_price)
        except (TypeError, ValueError) as error:
            raise QuoteLineInvalid("Each quote line needs a valid price.") from error
        if not math.isfinite(price):
            raise QuoteLineInvalid("Each quote line needs a valid price.")
        if price < MIN_QUOTE_LINE_PRICE_GBP:
            raise QuoteLineInvalid(f"Each quote line must be at least GBP {MIN_QUOTE_LINE_PRICE_GBP:.2f}.")
        if price > MAX_LINE_PRICE_GBP:
            raise QuoteLineInvalid("A quote line price is too high.")
        line["unit_price_gbp"] = round(price, 2)
        line["heading"] = heading[:200]
        checked.append(line)
    return checked


# --- vendor adjustments ------------------------------------------------------------------------------


def built_adjustments(requested: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The vendor's extras and discounts as stored: new ids, trimmed text, pence; zero amounts dropped."""
    stored: list[dict[str, Any]] = []
    for item in requested[:MAX_ADJUSTMENTS]:
        tag = str(item.get("adjustment_category") or item.get("tag") or "other").strip()[:50] or "other"
        label = str(item.get("label") or "").strip()[:200] or "Additional cost"
        try:
            amount = float(item.get("amount_gbp"))  # type: ignore[arg-type]
        except (TypeError, ValueError) as error:
            raise AdjustmentAmountInvalid() from error
        if amount == 0:
            continue
        if amount < -ADJUSTMENT_LIMIT_GBP or amount > ADJUSTMENT_LIMIT_GBP:
            raise AdjustmentOutOfRange()
        stored.append({"id": str(uuid.uuid4()), "tag": tag, "label": label, "amount_gbp": round(amount, 2)})
    return stored


def check_surcharge_caps(
    line_items: list[Any], adjustments: list[dict[str, Any]], *, max_single_gbp: float, max_percent: float
) -> None:
    """Raise when one surcharge is over the single cap, or all of them over a share of the packages."""
    positive_subtotal = 0.0
    for line in line_items:
        if not isinstance(line, dict):
            continue
        try:
            price = float(line.get("unit_price_gbp") or 0)
        except (TypeError, ValueError):
            continue
        if price > 0:
            positive_subtotal += price
    for adjustment in adjustments:
        if adjustment["amount_gbp"] > 0 and adjustment["amount_gbp"] > max_single_gbp:
            raise SurchargeTooHigh(f"Each surcharge cannot exceed GBP {max_single_gbp:,.0f}.")
    surcharges = sum(adjustment["amount_gbp"] for adjustment in adjustments if adjustment["amount_gbp"] > 0)
    if positive_subtotal > 0 and surcharges > positive_subtotal * (max_percent / 100.0):
        raise SurchargeTooHigh(f"Total surcharges cannot exceed {max_percent:.0f}% of the quoted line items.")


# --- capacity ----------------------------------------------------------------------------------------


def event_days(event_date: date, event_end_date: date | None) -> list[str]:
    """Every day of the event as ISO text; raise when it runs longer than a booking may cover."""
    if event_end_date is None:
        return [event_date.isoformat()]
    if (event_end_date - event_date).days > MAX_EVENT_SPAN_DAYS:
        raise EventSpanTooLong()
    span = (event_end_date - event_date).days
    return [(event_date + timedelta(days=offset)).isoformat() for offset in range(span + 1)]


def daily_cap(parsed_max_bookings: float | None) -> int:
    """The vendor's open bookings allowed per day, from their parsed `maxBookingsPerDay` (default 1)."""
    if parsed_max_bookings is None:
        return MIN_BOOKINGS_PER_DAY
    return max(MIN_BOOKINGS_PER_DAY, min(MAX_BOOKINGS_PER_DAY, int(parsed_max_bookings)))


def _covers_day(event_date: str, event_end_date: str | None, day_iso: str) -> bool:
    """True when a booking from `event_date` to `event_end_date` includes `day_iso`."""
    return event_date[:10] <= day_iso <= (event_end_date or event_date)[:10]


def check_daily_capacity(days: list[str], open_bookings: list[tuple[str, str | None]], cap: int) -> None:
    """Raise `VendorFullOnDate` for the first day that already has `cap` open bookings."""
    for day_iso in days:
        taken = sum(1 for start, end in open_bookings if _covers_day(start, end, day_iso))
        if taken >= cap:
            raise VendorFullOnDate(full_on_date_message(cap, day_iso))


def full_on_date_message(cap: int | str, day_iso: str) -> str:
    """The client-facing message for a day at the vendor's cap."""
    return (
        f"This vendor already has the maximum number of bookings ({cap}) on {day_iso}. "
        "Choose another date or contact the vendor."
    )


def capacity_error_from_db(message: str) -> VendorFullOnDate | None:
    """The friendly error for the capacity trigger's rejection, or `None` for any other database error."""
    if CAPACITY_DB_MARKER not in message:
        return None
    parts = message.split(":")
    day_iso = parts[1].strip() if len(parts) > 1 else ""
    cap_text = parts[2].strip().split()[0] if len(parts) > 2 and parts[2].strip() else ""
    if day_iso and cap_text.isdigit():
        return VendorFullOnDate(full_on_date_message(int(cap_text), day_iso))
    return VendorFullOnDate()


# --- lists and reviews -------------------------------------------------------------------------------


def recent_first(bookings: list[BookingRow]) -> list[BookingRow]:
    """Bookings with the latest activity first, then the newest, then by id."""
    return sorted(
        bookings,
        key=lambda booking: (
            booking.updated_at or booking.created_at or "",
            booking.created_at or "",
            booking.id,
        ),
        reverse=True,
    )


def review_image_urls(raw_urls: object) -> list[str]:
    """Up to five distinct http(s) image links from a stored review."""
    if not isinstance(raw_urls, list):
        return []
    urls: list[str] = []
    for raw_url in raw_urls:
        url = str(raw_url or "").strip()
        if not url or not url.startswith(("https://", "http://")) or url in urls:
            continue
        urls.append(url)
        if len(urls) >= MAX_REVIEW_IMAGES:
            break
    return urls


def clamped_rating(raw_rating: int | None) -> int:
    """A star rating held to 1-5 (a missing one reads as 1)."""
    return max(1, min(5, int(raw_rating or 0)))
