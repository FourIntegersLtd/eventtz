"""Send high-impact design-preview emails to a single inbox (local/dev use)."""

from __future__ import annotations

import sys

from app.features.bookings.receipts import receipt_context_for_email
from app.features.email.branding import transactional_email_context
from app.features.email.constants import APP_NAME
from app.features.email.render import render_template
from app.features.email.resend_client import send_email as resend_send
from app.features.email.service import get_email_service
from app.features.notifications.copy import PAYMENT_RECEIVED_CLIENT_BODY

TO = "yahayakehinde911@gmail.com"


def _record(results: list[tuple[str, bool]], label: str, ok: bool) -> None:
    results.append((label, ok))
    status = "sent" if ok else "FAILED"
    print(f"[{status}] {label}")


def main() -> int:
    svc = get_email_service()
    results: list[tuple[str, bool]] = []

    _record(
        results,
        "Admin — contact submitted (CONTACT chip)",
        svc.send_admin_contact_submitted(
            portal="client",
            user_email="preview@example.com",
            subject_line="Payment issue on my wedding booking",
            message=(
                "Hi team, I paid yesterday but the booking still shows pending. "
                "Can you check when you have a moment?"
            ),
            booking_id="bk_preview_design_001",
            to=[TO],
        ),
    )

    _record(
        results,
        "Admin — dispute opened (DISPUTE chip + CTA)",
        svc.send_admin_dispute_opened(
            booking_id="bk_preview_design_002",
            dispute_id="dsp_preview_001",
            summary="Vendor cancelled after payment. Client is requesting a full refund.",
            opened_by_email="client.preview@example.com",
            admin_url="https://www.eventtz.com/admin/disputes/dsp_preview_001",
            to=[TO],
        ),
    )

    _record(
        results,
        "Client — payment received (booking notification)",
        svc.send_booking_notification(
            kind="payment_received",
            to_email=TO,
            recipient_user_id="preview-user",
            booking_id="bk_preview_design_003",
            headline="Payment received",
            subtitle=None,
            body=PAYMENT_RECEIVED_CLIENT_BODY,
            action_url="https://www.eventtz.com/client/bookings/bk_preview_design_003",
            action_label="View booking",
            skip_dedupe=True,
        ),
    )

    _record(
        results,
        "Client — booking accepted (booking notification)",
        svc.send_booking_notification(
            kind="booking_accepted",
            to_email=TO,
            recipient_user_id="preview-user",
            booking_id="bk_preview_design_004",
            headline="Booking accepted",
            subtitle=None,
            body=(
                "Good news: the vendor has accepted your booking.\n\n"
                "When you are ready, open the booking to check the final total and complete payment."
            ),
            action_url="https://www.eventtz.com/client/bookings/bk_preview_design_004",
            action_label="View booking",
            skip_dedupe=True,
        ),
    )

    _record(
        results,
        "Client — welcome (marketing layout)",
        svc.send_welcome(to_email=TO, user_type="client"),
    )

    _record(
        results,
        "Auth — verify / reset layout",
        svc.send_admin_email_test(
            to_email=TO,
            layout="auth",
            message_body="This preview shows the new auth email card layout.",
        ),
    )

    receipt_payload = {
        "document_type": "client_payment_receipt",
        "receipt_number": "RCT-PREVIEW-001",
        "event_name": "Ada & James — Wedding reception",
        "event_date": "2026-09-12",
        "counterparty_name": "Scenery Studios",
        "paid_at": "2026-08-23T10:00:00Z",
        "payment_reference": "pi_preview_001",
        "line_items": [
            {"label": "Full-day photography package", "amount_label": "£1,200.00"},
            {"label": "Service fee", "amount_label": "£60.00"},
        ],
        "total_label": "£1,260.00",
    }
    receipt_ctx = receipt_context_for_email(receipt_payload)
    receipt_ctx.update(
        transactional_email_context(
            subject=str(receipt_ctx["headline"]),
            headline=str(receipt_ctx["headline"]),
            subtitle=str(receipt_ctx["subtitle"]),
            action_url="https://www.eventtz.com/client/bookings/bk_preview_design_005/receipt",
            action_label="View receipt",
        ),
    )
    receipt_html = render_template("booking/payment_receipt.html", receipt_ctx)
    receipt_text = render_template("booking/payment_receipt.txt", receipt_ctx)
    _record(
        results,
        "Client — payment receipt (line items)",
        resend_send(
            to=[TO],
            subject=f"Your payment receipt | {APP_NAME}",
            html=receipt_html,
            text=receipt_text,
        ),
    )

    sent = sum(1 for _, ok in results if ok)
    failed = [label for label, ok in results if not ok]
    print()
    print(f"Done: {sent}/{len(results)} delivered to {TO}")
    if failed:
        print("Failed:", ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
