"""In-process hourly booking maintenance (no host-specific cron)."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

import httpx

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.jobs.lock import JOB_BOOKING_MAINTENANCE, try_claim_job_period
from app.jobs.run_booking_maintenance import main as run_booking_maintenance_main

logger = get_logger(__name__)

_task: asyncio.Task[None] | None = None


def _is_upstream_unavailable(exc: BaseException) -> bool:
    """True when PostgREST/Supabase did not answer (timeout / network)."""
    return isinstance(exc, (httpx.TimeoutException, httpx.NetworkError))


def hour_period_key(now: datetime | None = None) -> str:
    stamp = now if now is not None else datetime.now(timezone.utc)
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    else:
        stamp = stamp.astimezone(timezone.utc)
    return stamp.strftime("%Y-%m-%dT%H")


def should_start_scheduler(settings: Settings | None = None) -> bool:
    cfg = settings if settings is not None else get_settings()
    return bool(cfg.is_production and cfg.booking_maintenance_interval_seconds > 0)


def run_locked_maintenance() -> None:
    period = hour_period_key()
    logger.info("booking maintenance tick period=%s", period)
    if not try_claim_job_period(JOB_BOOKING_MAINTENANCE, period):
        logger.info("booking maintenance skipped period=%s reason=lock_not_acquired", period)
        return
    logger.info("booking maintenance starting period=%s", period)
    started = time.monotonic()
    try:
        run_booking_maintenance_main()
    except Exception as exc:
        duration_ms = int((time.monotonic() - started) * 1000)
        if _is_upstream_unavailable(exc):
            # Retry next hour. logger.exception would page Sentry for a 30s PostgREST blip
            # and re-raising double-logged the same timeout from the asyncio loop.
            logger.warning(
                "booking maintenance unavailable period=%s duration_ms=%s",
                period,
                duration_ms,
            )
            return
        logger.exception(
            "booking maintenance failed period=%s duration_ms=%s",
            period,
            duration_ms,
        )
        raise
    logger.info(
        "booking maintenance finished period=%s duration_ms=%s",
        period,
        int((time.monotonic() - started) * 1000),
    )


async def _loop(interval_seconds: int) -> None:
    logger.info(
        "booking maintenance loop started interval_seconds=%s",
        interval_seconds,
    )
    while True:
        try:
            await asyncio.to_thread(run_locked_maintenance)
        except Exception:
            logger.exception("booking maintenance loop iteration failed")
        logger.info(
            "booking maintenance sleeping interval_seconds=%s",
            interval_seconds,
        )
        await asyncio.sleep(interval_seconds)


def start_booking_maintenance_scheduler() -> None:
    """Start the hourly loop when production settings allow it."""
    global _task
    if _task is not None and not _task.done():
        return
    settings = get_settings()
    if not should_start_scheduler(settings):
        logger.info(
            "booking maintenance scheduler off is_production=%s interval_seconds=%s",
            settings.is_production,
            settings.booking_maintenance_interval_seconds,
        )
        return
    interval = settings.booking_maintenance_interval_seconds
    _task = asyncio.create_task(_loop(interval), name="booking-maintenance")
    logger.info(
        "booking maintenance scheduler on is_production=%s interval_seconds=%s",
        settings.is_production,
        interval,
    )


async def stop_booking_maintenance_scheduler() -> None:
    global _task
    if _task is None:
        return
    logger.info("booking maintenance scheduler stopping")
    _task.cancel()
    try:
        await _task
    except asyncio.CancelledError:
        pass
    _task = None
    logger.info("booking maintenance scheduler stopped")
