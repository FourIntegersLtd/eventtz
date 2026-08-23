"""Claim a scheduled job period so two API processes do not both run it."""

from __future__ import annotations

from postgrest.exceptions import APIError

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


def _is_missing_job_runs_table(err: Exception) -> bool:
    if not isinstance(err, APIError):
        msg = str(err).lower()
        return "job_runs" in msg and (
            "does not exist" in msg or "42p01" in msg or "could not find" in msg
        )
    code = getattr(err, "code", None)
    msg = str(err).lower()
    return code == "42P01" or ("job_runs" in msg and "does not exist" in msg)
