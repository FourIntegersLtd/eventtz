"""Hourly booking maintenance — post-event reminders + overdue payout auto-release.

Run from backend/ (same env as the API — no extra secrets):

    PYTHONPATH=. python -m app.jobs.run_booking_maintenance

Railway cron schedule: ``0 * * * *`` with that command on a service that shares
``SUPABASE_*`` / ``STRIPE_*`` env vars with production.
"""

from __future__ import annotations

import sys

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.bookings.payments import (
    process_due_payout_auto_releases,
    send_completion_reminders,
)

logger = get_logger(__name__)


def main() -> int:
    if get_settings().local_auth_mode:
        logger.info("booking maintenance skipped (local auth mode)")
        return 0

    reminders_sent = send_completion_reminders()
    payouts_released = process_due_payout_auto_releases()
    logger.info(
        "booking maintenance run: reminders=%d payouts_released=%d",
        reminders_sent,
        payouts_released,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
