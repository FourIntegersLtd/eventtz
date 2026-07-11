"""Plain-English titles and bodies for in-app booking notifications."""

from __future__ import annotations

from typing import Literal

Portal = Literal["client", "vendor"]

# Kinds whose stored `body` is booking-specific (pricing, quotes) — keep it in the feed.
_USE_STORED_BODY: frozenset[str] = frozenset(
    {
        "booking_accepted",
        "booking_pricing_updated",
        "vendor_quote_received",
        "vendor_quote_accepted",
    }
)

# When the dashboard already surfaces live booking rows, skip these notification kinds.
DASHBOARD_DUPLICATE_KINDS: dict[Portal, frozenset[str]] = {
    "vendor": frozenset({"booking_request_received"}),
    "client": frozenset({"vendor_quote_received"}),
}

_COPY: dict[str, dict[Portal, tuple[str, str]]] = {
    "booking_request_received": {
        "vendor": ("New booking request", "Review the details and respond."),
        "client": ("Booking sent", "Waiting for the vendor to reply."),
    },
    "booking_accepted": {
        "client": ("Booking accepted", "You can pay when you are ready."),
        "vendor": ("Booking accepted", "The client accepted this booking."),
    },
    "booking_declined_by_vendor": {
        "client": ("Booking declined", "The vendor cannot take this booking."),
        "vendor": ("Booking declined", "You declined this request."),
    },
    "booking_cancelled_by_client": {
        "vendor": ("Booking cancelled", "The client cancelled this booking."),
        "client": ("Booking cancelled", "You cancelled this booking."),
    },
    "booking_cancelled_by_vendor": {
        "client": ("Booking cancelled", "The vendor cancelled this booking."),
        "vendor": ("Booking cancelled", "You cancelled this booking."),
    },
    "booking_completed": {
        "client": ("Booking complete", "Thanks for using Eventtz."),
        "vendor": ("Booking complete", "This booking is marked complete."),
    },
    "booking_pricing_updated": {
        "client": ("Price updated", "The vendor changed the price for this booking."),
        "vendor": ("Price updated", "You updated the price for this booking."),
    },
    "vendor_quote_received": {
        "client": ("New quote", "Review the quote and accept or decline."),
        "vendor": ("Quote sent", "Waiting for the client to respond."),
    },
    "vendor_quote_accepted": {
        "vendor": ("Quote accepted", "The client accepted your quote."),
        "client": ("Quote accepted", "You accepted this quote."),
    },
    "vendor_quote_declined": {
        "vendor": ("Quote declined", "The client declined your quote."),
        "client": ("Quote declined", "You declined this quote."),
    },
    "vendor_quote_withdrawn": {
        "client": ("Quote withdrawn", "The vendor withdrew their quote."),
        "vendor": ("Quote withdrawn", "You withdrew this quote."),
    },
    "payment_received": {
        "client": ("Payment received", "Your payment went through."),
        "vendor": ("Payment received", "The client paid for this booking."),
    },
    "vendor_payment_received": {
        "vendor": ("Payment received", "The client paid. Payout follows after the event."),
        "client": ("Payment sent", "The vendor has been notified."),
    },
    "vendor_payout_released": {
        "vendor": ("Payout sent", "Your payout for this booking was released."),
        "client": ("Payout released", "The vendor received their payout."),
    },
    "payment_refunded": {
        "client": ("Refund issued", "Your payment was refunded."),
        "vendor": ("Refund issued", "The client was refunded for this booking."),
    },
    "completion_confirmed_awaiting_other_party": {
        "client": ("Confirm completion", "The other party marked this booking complete."),
        "vendor": ("Confirm completion", "The other party marked this booking complete."),
    },
}


def format_booking_notification(
    *,
    kind: str,
    portal: Portal,
    event_name: str | None,
    stored_body: str | None,
) -> tuple[str, str | None]:
    """Return (title, body) in plain English."""
    fallback_title, fallback_body = _COPY.get(kind, {}).get(
        portal,
        ("Booking update", stored_body or "Open the booking for details."),
    )

    title = (event_name or "").strip() or fallback_title

    if kind in _USE_STORED_BODY and stored_body and stored_body.strip():
        body = stored_body.strip()
    else:
        body = fallback_body

    return title, body
