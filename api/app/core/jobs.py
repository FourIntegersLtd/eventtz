"""Background jobs on procrastinate, stored in Postgres (ADR 0008; copied from OSCE `platform-api`).

Why Postgres and not Redis: a job row is written in the same database, so a
service can enqueue "send the receipt" inside the transaction that marks the
booking paid. Either both happen or neither does. Jobs survive deploys and
Redis restarts, and the queue is visible with plain SQL.

Each slice with background work declares its tasks inside a `register()`
function in its own `jobs.py`, so importing the module for its logic (which the
tests do) needs no configured queue. `get_jobs_app` calls every slice's
`register()`, and refuses to start if a `jobs.py` has none — otherwise a slice
could run with an empty task set while its tests, calling task bodies
directly, stayed green.
"""

from __future__ import annotations

import importlib
import json
import pkgutil
from datetime import datetime
from typing import Any

import procrastinate
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import libpq_url
from app.core.settings import get_settings

_app: procrastinate.App | None = None


def discover_task_modules() -> list[str]:
    """Every `app.features.<slice>.jobs` module, imported."""
    features = importlib.import_module("app.features")
    found: list[str] = []
    for module_info in pkgutil.iter_modules(features.__path__):
        candidate = f"app.features.{module_info.name}.jobs"
        try:
            importlib.import_module(candidate)
        except ModuleNotFoundError as error:
            if error.name != candidate:
                raise
            continue
        found.append(candidate)
    return found


def _register_slice_tasks() -> None:
    """Call every slice's `jobs.register()`, refusing to start if one is missing."""
    for module_name in discover_task_modules():
        module = importlib.import_module(module_name)
        register = getattr(module, "register", None)
        if not callable(register):
            raise RuntimeError(
                f"{module_name} declares no register() function. Every jobs module must register "
                "its tasks in one, or the worker never sees them."
            )
        register()


def get_jobs_app() -> procrastinate.App:
    """The one procrastinate app, with every slice's tasks registered on it."""
    global _app
    if _app is None:
        settings = get_settings()
        jobs_app = procrastinate.App(
            connector=procrastinate.PsycopgConnector(conninfo=libpq_url(settings.database_url)),
        )
        # Assigned before the slices register: each `register()` fetches the app
        # through this function, so it has to be there already.
        _app = jobs_app
        try:
            _register_slice_tasks()
        except BaseException:
            _app = None
            raise
    return _app


def registered_task_names() -> set[str]:
    """Task names the worker will run, builtins excluded."""
    return {name for name in get_jobs_app().tasks if not name.startswith(("builtin:", "procrastinate."))}


async def defer_in_transaction(
    session: AsyncSession,
    *,
    queue: str,
    task: str,
    args: dict[str, Any],
    queueing_lock: str,
    lock: str | None = None,
    priority: int = 0,
    scheduled_at: datetime | None = None,
    ignore_lock_conflict: bool = False,
) -> None:
    """Write a queue row in the caller's transaction.

    Deliberately not procrastinate's `defer_async`: its connector holds its own
    pool, so deferring through it would commit the job on a different connection
    than the data justifying it. Calling procrastinate's own SQL function on our
    session keeps both in one transaction.

    - `queueing_lock` makes a redelivered message idempotent: a second row with
      the same lock is refused while the first is still waiting.
    - `lock` serialises *execution* instead: jobs sharing one run one at a time.
    - `scheduled_at` runs the job at a later moment rather than now.

    When `ignore_lock_conflict` is true, a duplicate queueing lock is caught
    inside a savepoint so the surrounding transaction survives — for
    fire-and-forget nudges where a second caller should silently no-op.
    """
    params = {
        "queue": queue,
        "task": task,
        "priority": priority,
        "lock": lock,
        "queueing_lock": queueing_lock,
        "args": json.dumps(args),
        "scheduled_at": scheduled_at,
    }
    statement = text(
        "SELECT procrastinate_defer_jobs_v1(ARRAY[ROW("
        ":queue, :task, :priority, :lock, :queueing_lock, CAST(:args AS jsonb), :scheduled_at"
        ")]::procrastinate_job_to_defer_v1[])"
    )
    if ignore_lock_conflict:
        try:
            async with session.begin_nested():
                await session.execute(statement, params)
        except IntegrityError:
            pass
    else:
        await session.execute(statement, params)
