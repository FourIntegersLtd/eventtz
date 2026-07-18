"""Hourly booking maintenance: post-event reminders, payout release, enquiry nudges.

Run from the backend directory (same environment as the API):

    PYTHONPATH=. python -m app.jobs.run_booking_maintenance

Railway cron schedule: ``0 * * * *`` with that command on a service that shares
production ``SUPABASE_*`` and ``STRIPE_*`` environment variables.
"""

from __future__ import annotations

import sys

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.bookings.payments import (
    process_due_payout_auto_releases,
    send_completion_reminders,
)
from app.features.bookings.funnel import mark_stale_enquiries_no_response
from app.features.bookings.enquiry_reminders import process_enquiry_response_maintenance

logger = get_logger(__name__)


def main() -> int:
    if get_settings().local_auth_mode:
        logger.info("booking maintenance skipped (local auth mode)")
        return 0

    reminders_sent = send_completion_reminders()
    payouts_released = process_due_payout_auto_releases()
    sla_hours = get_settings().enquiry_response_sla_hours
    stale_marked = mark_stale_enquiries_no_response(sla_hours=sla_hours)
    enquiry = process_enquiry_response_maintenance()
    logger.info(
        "booking maintenance run: reminders=%d payouts_released=%d stale_enquiries=%d "
        "enquiry_vendor_reminders=%d enquiry_client_nudges=%d",
        reminders_sent,
        payouts_released,
        stale_marked,
        enquiry.get("vendor_reminders", 0),
        enquiry.get("client_nudges", 0),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
