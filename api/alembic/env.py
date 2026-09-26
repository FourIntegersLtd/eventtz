"""Alembic environment (copied from OSCE `platform-api`).

Reads the database URL from app settings and diffs against `Base.metadata`,
which is filled by importing every slice's `models.py`.
"""

from __future__ import annotations

import asyncio
import threading

from sqlalchemy import Connection, pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.db import AUTOGENERATE_FILTERS, Base, import_all_models, sqlalchemy_url
from app.core.settings import get_settings

config = context.config
config.set_main_option("sqlalchemy.url", sqlalchemy_url(get_settings().database_url))

import_all_models()
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Print the SQL instead of running it (`alembic upgrade --sql`)."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **AUTOGENERATE_FILTERS,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_sync(connection: Connection) -> None:
    """Run the pending revisions on an open connection, in one transaction."""
    context.configure(connection=connection, target_metadata=target_metadata, **AUTOGENERATE_FILTERS)
    with context.begin_transaction():
        context.run_migrations()


async def _run_async() -> None:
    """Open an async engine without a pool, migrate, and close it."""
    engine = async_engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    async with engine.connect() as connection:
        await connection.run_sync(_run_sync)
    await engine.dispose()


def run_migrations_online() -> None:
    """Run the migrations on a fresh thread, whatever loop the caller holds.

    Always a thread, not only when a loop is running: `asyncio.run` sets the
    calling thread's event loop to None when it finishes, so running it on the
    main thread after pytest-asyncio has created its session loop clobbers that
    loop, and every database test after the first unit test fails with "no
    current event loop".
    """
    errors: list[BaseException] = []

    def runner() -> None:
        """Migrate on this thread's own event loop, keeping any failure for the caller."""
        try:
            asyncio.run(_run_async())
        except BaseException as error:  # noqa: BLE001 - re-raised on the calling thread
            errors.append(error)

    thread = threading.Thread(target=runner)
    thread.start()
    thread.join()
    if errors:
        raise errors[0]


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
