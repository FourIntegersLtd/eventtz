"""Plain-English titles and bodies for in-app booking notifications."""

from __future__ import annotations

from typing import Literal

Portal = Literal["client", "vendor"]

# Kinds whose stored `body` is booking-specific (pricing, quotes, refunds, deadlines) —
# keep it in the feed and emails when present.
_USE_STORED_BODY: frozenset[str] = frozenset(
    {
        "booking_accepted",
        "booking_declined_by_vendor",
        "booking_pricing_updated",
        "vendor_quote_received",
        "vendor_quote_accepted",
        "vendor_quote_declined",
        "vendor_quote_withdrawn",
        "client_confirmed_updated_price",
        "client_declined_updated_price",
        "booking_cancelled_by_client",
        "booking_cancelled_by_vendor",
        "payment_received",
        "vendor_payment_received",
        "payment_refunded",
        "completion_confirmed_awaiting_other_party",
        "completion_reminder",
        "vendor_completion_reminder",
    }
)

# When the dashboard already surfaces live booking rows, skip these notification kinds.
DASHBOARD_DUPLICATE_KINDS: dict[Portal, frozenset[str]] = {
    "vendor": frozenset({"booking_request_received"}),
    "client": frozenset({"vendor_quote_received"}),
}

_COPY: dict[str, dict[Portal, tuple[str, str]]] = {
    "booking_request_received": {
        "vendor": (
            "New booking request",
            "A client has sent you a new booking request on Eventtz.\n\n"
            "Please review the date, service and details, and respond when you can. "
            "The client will be notified as soon as you accept or decline.",
        ),
        "client": (
            "Booking sent",
            "Your booking request has been sent to the vendor.\n\n"
            "They will review the details and get back to you shortly. "
            "You can follow progress from your bookings page.",
        ),
    },
    "booking_accepted": {
        "client": (
            "Booking accepted",
            "Good news — the vendor has accepted your booking.\n\n"
            "You can pay when you are ready. Open the booking to review the final total "
            "and complete payment.",
        ),
        "vendor": (
            "Booking accepted",
            "The client has accepted this booking.\n\n"
            "We will notify you as soon as payment is received.",
        ),
    },
    "booking_declined_by_vendor": {
        "client": (
            "Booking declined",
            "Unfortunately, the vendor is unable to take this booking.\n\n"
            "You can browse other vendors on Eventtz and send a new request whenever you are ready.",
        ),
        "vendor": (
            "Booking declined",
            "You declined this booking request.\n\n"
            "The client has been notified. No further action is needed on your side.",
        ),
    },
    "booking_cancelled_by_client": {
        "vendor": (
            "Booking cancelled",
            "The client has cancelled this booking.\n\n"
            "The booking is now closed. You can still message them on Eventtz if you need to.",
        ),
        "client": (
            "Booking cancelled",
            "You cancelled this booking.\n\n"
            "The vendor has been notified. If you paid in advance, any refund will be processed separately.",
        ),
    },
    "booking_cancelled_by_vendor": {
        "client": (
            "Booking cancelled",
            "The vendor has cancelled this booking.\n\n"
            "We are sorry this did not work out. You can explore other vendors on Eventtz whenever you are ready.",
        ),
        "vendor": (
            "Booking cancelled",
            "You cancelled this booking.\n\n"
            "The client has been notified.",
        ),
    },
    "booking_completed": {
        "client": (
            "Booking complete",
            "This booking is now complete.\n\n"
            "Thank you for using Eventtz. We hope your event went well.",
        ),
        "vendor": (
            "Booking complete",
            "This booking has been marked as complete.\n\n"
            "Thank you for providing your service through Eventtz.",
        ),
    },
    "booking_pricing_updated": {
        "client": (
            "Updated price",
            "Your vendor has sent an updated price for this booking.\n\n"
            "Please review the new total and accept or decline when you are ready.",
        ),
        "vendor": (
            "Updated price sent",
            "You sent an updated price to the client.\n\n"
            "We will notify you as soon as they confirm.",
        ),
    },
    "client_confirmed_updated_price": {
        "vendor": (
            "Price confirmed",
            "The client accepted the updated price.\n\n"
            "Payment is now due. We will let you know when it is received.",
        ),
        "client": (
            "Price confirmed",
            "You accepted the updated price.\n\n"
            "You can pay when you are ready from your bookings page.",
        ),
    },
    "client_declined_updated_price": {
        "vendor": (
            "Booking declined",
            "The client declined the updated price.\n\n"
            "This booking has been closed. No further action is needed.",
        ),
        "client": (
            "Booking declined",
            "You declined the updated price.\n\n"
            "This booking has been closed. You can send a new request or browse other vendors.",
        ),
    },
    "vendor_quote_received": {
        "client": (
            "New quote",
            "You have received a new quote from a vendor.\n\n"
            "Open the booking to review the details and accept or decline when you are ready.",
        ),
        "vendor": (
            "Quote sent",
            "Your quote has been sent to the client.\n\n"
            "We will notify you when they respond.",
        ),
    },
    "vendor_quote_accepted": {
        "vendor": (
            "Quote accepted",
            "The client accepted your quote.\n\n"
            "Payment will follow once they are ready.",
        ),
        "client": (
            "Quote accepted",
            "You accepted this quote.\n\n"
            "You can pay when you are ready from your bookings page.",
        ),
    },
    "vendor_quote_declined": {
        "vendor": (
            "Quote declined",
            "The client declined your quote.\n\n"
            "The booking has been closed. You can still message them on Eventtz.",
        ),
        "client": (
            "Quote declined",
            "You declined this quote.\n\n"
            "The vendor has been notified. You can request a new quote or browse other vendors.",
        ),
    },
    "vendor_quote_withdrawn": {
        "client": (
            "Quote withdrawn",
            "The vendor withdrew their quote.\n\n"
            "This booking is no longer active. You can message them or explore other vendors.",
        ),
        "vendor": (
            "Quote withdrawn",
            "You withdrew your quote.\n\n"
            "The client has been notified.",
        ),
    },
    "payment_received": {
        "client": (
            "Payment received",
            "Your payment was successful.\n\n"
            "We will hold the funds safely until the event is complete. "
            "After the event, please confirm that everything went well so the vendor can be paid.",
        ),
        "vendor": (
            "Payment received",
            "The client has paid for this booking.\n\n"
            "We will release your payout after the event is confirmed complete.",
        ),
    },
    "vendor_payment_received": {
        "vendor": (
            "Payment received",
            "The client has paid for this booking.\n\n"
            "Confirm when the event is done to receive your payout sooner. "
            "If you do not confirm, payment is released automatically 48 hours after the event.",
        ),
        "client": (
            "Payment sent",
            "Your payment has been sent.\n\n"
            "The vendor has been notified and can see the booking is paid.",
        ),
    },
    "vendor_payout_released": {
        "vendor": (
            "Payout sent",
            "Your payout for this booking has been released.\n\n"
            "It should arrive in your connected account shortly, depending on your bank.",
        ),
        "client": (
            "Payout released",
            "The vendor has received their payout for this booking.\n\n"
            "Thank you for completing your booking on Eventtz.",
        ),
    },
    "payment_refunded": {
        "client": (
            "Refund issued",
            "A refund has been issued for this booking.\n\n"
            "It should reach your card within 5–10 working days, depending on your bank.",
        ),
        "vendor": (
            "Refund issued",
            "The client was refunded for this booking.\n\n"
            "The booking is now closed from a payment perspective.",
        ),
    },
    "completion_confirmed_awaiting_other_party": {
        "client": (
            "Confirm completion",
            "The other party has marked this booking as complete.\n\n"
            "Please confirm on your side so the vendor can be paid, or report a problem if something went wrong.",
        ),
        "vendor": (
            "Confirm completion",
            "The other party has marked this booking as complete.\n\n"
            "Please confirm on your side to receive your payout.",
        ),
    },
    "completion_reminder": {
        "client": (
            "How did your event go?",
            "We hope your event went well.\n\n"
            "If everything was as expected, please confirm the booking is complete. "
            "If something went wrong, report a problem before the automatic payout date.",
        ),
    },
    "vendor_completion_reminder": {
        "vendor": (
            "Confirm to get paid",
            "Your event date has passed.\n\n"
            "Please confirm the booking is complete to receive your payout sooner. "
            "If the client does not respond, payment is released automatically unless they report a problem.",
        ),
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
        ("Booking update", stored_body or "Open the booking on Eventtz for the latest details."),
    )

    title = (event_name or "").strip() or fallback_title

    if kind in _USE_STORED_BODY and stored_body and stored_body.strip():
        body = stored_body.strip()
    else:
        body = fallback_body

    return title, body
