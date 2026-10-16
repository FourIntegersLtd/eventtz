"""Pure content of booking emails with more than a stock headline and body.

Today that is the client's "vendor has not replied yet" email, which lists other
vendors to try. Nothing here touches the database or the mailer; `service_booking.py`
renders and sends it.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.features.notifications.domain import APP_NAME
from app.features.notifications.domain_account_emails import TransactionalEmail

NO_RESPONSE_HEADLINE = "Vendor has not replied yet"


@dataclass(frozen=True)
class AlternativeVendorLine:
    """One other vendor the client may try: their name, the link to their page and how fast they reply."""

    name: str
    href: str
    reply: str


def client_vendor_no_response_email(
    *,
    vendor_name: str,
    event_name: str,
    alternatives: list[AlternativeVendorLine],
    booking_url: str,
    browse_url: str,
) -> TransactionalEmail:
    """The email telling a client their vendor has not answered after 24 hours, with other options."""
    lines = [
        f"{vendor_name} has not replied to your request for {event_name} yet.",
        "",
        "You can still message them from your booking, or try other vendors from a similar search.",
    ]
    if alternatives:
        lines.append("")
        lines.append("Here are a few other options:")
        for alternative in alternatives:
            lines.append(
                f"\u2022 {alternative.name or 'Vendor'}: {alternative.reply}\n"
                f"  {alternative.href or browse_url}"
            )
    lines.append("")
    lines.append("Requesting more than one vendor is fine until you pay.")
    return TransactionalEmail(
        subject=f"{NO_RESPONSE_HEADLINE} | {APP_NAME}",
        title=NO_RESPONSE_HEADLINE,
        headline=NO_RESPONSE_HEADLINE,
        body="\n".join(lines),
        action_url=booking_url,
        action_label="View booking",
    )
