"""Background worker entrypoint: `python -m app.worker.main` (copied from OSCE `platform-api`).

Runs every task declared in `app/features/*/jobs.py`. Scale by running more
replicas of this process; each takes jobs with SKIP LOCKED so they never
double-run. Deployed as a second Railway service from the same image as the API.
"""

from __future__ import annotations

import procrastinate

from app.core.db import import_all_models
from app.core.jobs import get_jobs_app
from app.core.logging import configure_logging, get_logger
from app.core.settings import get_settings


def build_worker_app() -> procrastinate.App:
    """The job app, with every model imported first.

    A slice's `jobs.py` pulls in its own models and no others, so a mapper whose
    foreign key names a table nothing imported could not be configured.
    `import_all_models` closes that gap, as it does for Alembic. Separate from
    `main()` so a test can check the app builds without starting a worker.
    """
    import_all_models()
    return get_jobs_app()


def main() -> None:
    """Start the worker: take jobs from the queue and run them until the process is stopped."""
    settings = get_settings()
    configure_logging(settings)
    jobs_app = build_worker_app()
    get_logger(__name__).info(
        "worker starting concurrency=%s tasks=%s", settings.worker_concurrency, sorted(jobs_app.tasks)
    )
    jobs_app.run_worker(
        concurrency=settings.worker_concurrency,
        # A job scheduled for later is found by polling rather than by notification.
        fetch_job_polling_interval=settings.worker_fetch_job_polling_seconds,
    )


if __name__ == "__main__":
    main()
