"""Claim a scheduled job period so two API processes do not both run it."""

from __future__ import annotations

from app.core.db import get_db
from app.core.logging import get_logger

logger = get_logger(__name__)

JOB_BOOKING_MAINTENANCE = "booking_maintenance"


def try_claim_job_period(job_name: str, period_key: str) -> bool:
    """Return True if this process should run the job for ``period_key``.

    Unique ``(job_name, period_key)`` is the lock. If ``job_runs`` is not
    migrated yet, return True so a single API process still runs the work.
    """
    try:
        get_db().table("job_runs").insert(
            {"job_name": job_name, "period_key": period_key},
        ).execute()
        return True
    except Exception as e:
        err = str(e).lower()
        if "duplicate" in err or "23505" in err or "unique" in err:
            logger.info(
                "job skip already claimed job=%s period=%s",
                job_name,
                period_key,
            )
            return False
        if _is_missing_job_runs_table(e):
            logger.warning(
                "job_runs table missing - run migration 075; running %s without lock",
                job_name,
            )
            return True
        logger.exception(
            "job claim failed job=%s period=%s",
            job_name,
            period_key,
        )
        return False


_MISSING_JOB_RUNS_MARKERS = (
    "does not exist",
    "could not find",
    "schema cache",
    "42p01",
    "pgrst205",
)


def _is_missing_job_runs_table(err: Exception) -> bool:
    # PostgREST raises APIError PGRST205 ("not in the schema cache") when the
    # table is absent or the cache is stale — not Postgres 42P01.
    msg = str(err).lower()
    if "job_runs" not in msg:
        return False
    code = str(getattr(err, "code", "") or "").upper()
    if code in {"42P01", "PGRST205"}:
        return True
    return any(marker in msg for marker in _MISSING_JOB_RUNS_MARKERS)
