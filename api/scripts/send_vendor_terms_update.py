"""One-off: notify vendors of the Terms version 2026-11-16 (sent 2026-10-18).

The terms-updated notice for version 2026-11-01 went out before it was ready
(removed in b02de70), and that version never took effect. It is replaced by
2026-11-16; this email gives every open vendor the required notice
(`vendorTermsChangeNoticeDays`), with an apology for the earlier email.

Usage (from api/, with the production env injected by `railway run --service api`):

    python -m scripts.send_vendor_terms_update --to someone@example.com   # one test copy, no database
    python -m scripts.send_vendor_terms_update --vendors                  # list recipients only
    python -m scripts.send_vendor_terms_update --vendors --send           # send to every listed vendor
    python -m scripts.send_vendor_terms_update --list emails.txt --send   # send to one address per line

Recipients are all open vendor accounts with an email address.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

from app.adapters.resend_mailer import ResendMailer
from app.core.db import dispose_engine, job_session
from app.core.site import public_url
from app.features.identity import repository as identity_repository
from app.features.notifications.domain_account_emails import TransactionalEmail
from app.features.notifications.service import render_booking_notification

EFFECTIVE_DATE = "16 November 2026"
HEADLINE = "Our updated Terms of Service"
# Resend refuses bursts over its per-second rate; the 2026-10-17 notice lost 48 vendors that way.
SECONDS_BETWEEN_SENDS = 1.0

# (policy name, what the client gets back by notice); mirrors bookings/domain_cancellation.py.
POLICY_LINES = (
    ("Flexible", "7+ days full refund · 2 to 6 days 50% · Under 2 days no refund"),
    ("Moderate", "30+ days full refund · 7 to 29 days 50% · Under 7 days no refund"),
    (
        "Strict",
        "90+ days full refund · 60 to 89 days 75% · 30 to 59 days 50% · Under 30 days no refund",
    ),
)


def build_email() -> TransactionalEmail:
    """The Terms-change notice with the cancellation-policy summary, in the branded layout."""
    terms_url = public_url("/compliances/terms-of-service")
    # Each policy is its name on one line and one band per line beneath it, so the tiers
    # read cleanly on a phone; the bands keep the wording agreed for the email.
    policies_html = "".join(
        f'<p style="margin:0 0 4px"><strong>{name}</strong></p>'
        f'<p style="margin:0 0 16px;line-height:1.7">{"<br>".join(bands.split(" · "))}</p>'
        for name, bands in POLICY_LINES
    )
    policies_text = "\n\n".join(
        name + "\n" + "\n".join(f"- {band}" for band in bands.split(" · ")) for name, bands in POLICY_LINES
    )
    body_html = (
        "<p>Hello,</p>"
        "<p>Thank you for being part of Eventtz.</p>"
        "<p>We've updated our Terms of Service. The new version takes effect on "
        f"<strong>{EFFECTIVE_DATE}</strong> and replaces the earlier email we sent, which went out "
        "before it was ready. We apologise for any confusion.</p>"
        "<p><strong>The three cancellation policies.</strong> If a client cancels, they get back "
        "this much of your price:</p>"
        f"{policies_html}"
        "<p>You keep whatever isn't refunded. You can choose your policy in your vendor profile. "
        "If you don't choose one, <strong>Flexible</strong> will apply.</p>"
        f'<p><strong><a href="{terms_url}">Read the updated Terms</a></strong></p>'
        "<p>If you have any questions, please don't hesitate to reply to this email. "
        "We'll be very happy to help.</p>"
        "<p>Thank you for your understanding.</p>"
        "<p>Warm regards,<br>The Eventtz team</p>"
    )
    body_plain = (
        "Hello,\n\n"
        "Thank you for being part of Eventtz.\n\n"
        "We've updated our Terms of Service. The new version takes effect on "
        f"{EFFECTIVE_DATE} and replaces the earlier email we sent, which went out "
        "before it was ready. We apologise for any confusion.\n\n"
        "The three cancellation policies. If a client cancels, they get back this much of "
        "your price:\n\n"
        f"{policies_text}\n\n"
        "You keep whatever isn't refunded. You can choose your policy in your vendor profile. "
        "If you don't choose one, Flexible will apply.\n\n"
        f"Read the updated Terms: {terms_url}\n\n"
        "If you have any questions, please don't hesitate to reply to this email. "
        "We'll be very happy to help.\n\n"
        "Thank you for your understanding.\n\n"
        "Warm regards,\nThe Eventtz team"
    )
    return TransactionalEmail(
        subject=f"{HEADLINE} | Eventtz",
        title=HEADLINE,
        headline=HEADLINE,
        body_html=body_html,
        body_plain=body_plain,
    )


async def _vendor_recipients() -> list[str]:
    """Emails of every open vendor account."""
    async with job_session() as session:
        return await identity_repository.open_emails_of_type(session, user_type="vendor")


def _send(recipients: list[str]) -> int:
    """Send one copy per recipient; returns how many Resend accepted."""
    mailer = ResendMailer()
    content = build_email()
    accepted = 0
    for position, recipient in enumerate(recipients):
        if position:
            time.sleep(SECONDS_BETWEEN_SENDS)
        delivered = mailer.send(render_booking_notification(recipient, content))
        accepted += int(delivered)
        sys.stdout.write(f"{'sent' if delivered else 'FAILED'}  {recipient}\n")
    return accepted


async def main() -> int:
    """Parse arguments, then send a test copy or list/send to the vendor audience."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--to", help="send a single test copy to this address (no database)")
    target.add_argument("--vendors", action="store_true", help="every open vendor account")
    target.add_argument("--list", type=Path, help="a file of recipient emails, one per line")
    parser.add_argument("--send", action="store_true", help="with --vendors or --list: actually send")
    arguments = parser.parse_args()

    if arguments.to:
        return 0 if _send([arguments.to]) == 1 else 1

    if arguments.list:
        recipients = [line.strip() for line in arguments.list.read_text().splitlines() if line.strip()]
    else:
        try:
            recipients = await _vendor_recipients()
        finally:
            await dispose_engine()
    sys.stdout.write(f"{len(recipients)} recipients.\n")
    if not arguments.send:
        sys.stdout.write("".join(f"  {recipient}\n" for recipient in recipients))
        sys.stdout.write("Dry run: nothing sent. Add --send to email them.\n")
        return 0
    accepted = _send(recipients)
    sys.stdout.write(f"Done: {accepted}/{len(recipients)} accepted by Resend.\n")
    return 0 if accepted == len(recipients) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
