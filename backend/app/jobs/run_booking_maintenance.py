"""Booking maintenance: post-event reminders, payout release, enquiry nudges.

The live API runs this hourly from ``app.jobs.scheduler`` when ``IS_PRODUCTION``
is true. You can still run it by hand (same env as the API):

    PYTHONPATH=. python -m app.jobs.run_booking_maintenance
"""

from __future__ import annotations

import sys

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.bookings.payments import (
    process_due_payout_auto_releases,
    send_completion_reminders,
)
from app.features.bookings.booking_funnel_timestamps import mark_stale_enquiries_no_response
from app.features.bookings.enquiry_reminders import process_enquiry_response_maintenance
from app.features.bookings.lifecycle_reminders import process_lifecycle_reminders

logger = get_logger(__name__)


def main() -> int:
    logger.info("booking maintenance job started")
    reminders_sent = send_completion_reminders()
    payouts_released = process_due_payout_auto_releases()
    sla_hours = get_settings().enquiry_response_sla_hours
    stale_marked = mark_stale_enquiries_no_response(sla_hours=sla_hours)
    enquiry = process_enquiry_response_maintenance()
    lifecycle = process_lifecycle_reminders()
    logger.info(
        "booking maintenance run complete reminders=%d payouts_released=%d stale_enquiries=%d "
        "enquiry_vendor_reminders=%d enquiry_client_nudges=%d "
        "event_tomorrow=%d pay_to_confirm=%d payouts_setup=%d",
        reminders_sent,
        payouts_released,
        stale_marked,
        enquiry.get("vendor_reminders", 0),
        enquiry.get("client_nudges", 0),
        lifecycle.get("event_tomorrow", 0),
        lifecycle.get("pay_to_confirm", 0),
        lifecycle.get("payouts_setup", 0),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
