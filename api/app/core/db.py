"""Database access (ADR 0002; copied from OSCE `platform-api`).

- `Base` is the declarative base every slice's `models.py` extends. It carries a
  naming convention so constraints get stable names Alembic can drop later.
- `get_session` is the FastAPI dependency: one session and one transaction per
  request. The transaction commits when the handler returns and rolls back when
  it raises, so services and repositories never call commit themselves.
- `job_session` is the same contract for background jobs; `stream_session` opens
  the short read-only transactions a live-update stream needs.

Only repositories (`repository*.py`) build or run SQL; this module only opens
sessions, declares the base classes, and converts values at the row boundary
(`as_uuid`, `plain_value`, `plain_row`).
"""

from __future__ import annotations

import importlib
import pkgutil
import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import DateTime, MetaData, Row, Uuid, func
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.settings import get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """The declarative base every slice's `models.py` extends."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKey:
    """Mixin giving a table a random UUID primary key, also defaulted by Postgres."""

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )


class Timestamps:
    """Mixin giving a table `created_at`/`updated_at`, both set by Postgres."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# Baseline tables whose slice has not been rebuilt yet, so no `models.py` maps
# them. Autogenerate would read each as an orphan to drop. A slice's rebuild
# maps its tables and deletes them from this list; when it is empty, delete it.
UNMAPPED_BASELINE_TABLES = frozenset(
    {
        "job_runs",
    }
)


def include_name(name: str | None, type_: str, _parent: object) -> bool:
    """Hide the job queue and the not-yet-mapped baseline tables from autogenerate.

    procrastinate ships its own schema, applied verbatim by migration 0001, so
    its tables are never in `Base.metadata`. Without this filter autogenerate
    reads them as orphans and writes `drop_table` for every one.
    """
    if name and name.startswith("procrastinate"):
        return False
    return not (type_ == "table" and name in UNMAPPED_BASELINE_TABLES)


def include_object(
    entity: object, name: str | None, type_: str, reflected: bool, _compare_to: object
) -> bool:
    """The same filter in the shape Alembic's `include_object` hook expects.

    Also skips a database foreign key into an unmapped table: the model cannot
    declare it until the table it points at is mapped.
    """
    if type_ == "foreign_key_constraint" and reflected:
        referred_table = getattr(getattr(entity, "referred_table", None), "name", None)
        if referred_table in UNMAPPED_BASELINE_TABLES:
            return False
    return include_name(name, type_, None)


AUTOGENERATE_FILTERS: dict[str, object] = {
    "include_name": include_name,
    "include_object": include_object,
    "compare_type": True,
}


def sqlalchemy_url(url: str) -> str:
    """Normalise any Postgres URL to the async psycopg driver.

    Railway hands out `postgres://` or `postgresql://`; SQLAlchemy needs the
    driver spelled out.
    """
    for prefix in ("postgresql+psycopg://", "postgresql+asyncpg://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


def libpq_url(url: str) -> str:
    """The same URL in the form libpq/psycopg (and procrastinate) expect."""
    return "postgresql://" + sqlalchemy_url(url)[len("postgresql+psycopg://") :]


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """The process-wide engine, created on first use."""
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            sqlalchemy_url(settings.database_url),
            pool_size=settings.database_pool_size,
            pool_pre_ping=True,
            echo=settings.database_echo,
            # Timestamps come back in UTC whatever the server's default zone, so the
            # ISO text at the row boundary matches the baseline's `+00:00` form.
            connect_args={"options": "-c timezone=UTC"},
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """The session factory bound to the process-wide engine, creating the engine if needed."""
    get_engine()
    assert _session_factory is not None
    return _session_factory


async def dispose_engine() -> None:
    """Close the process-wide engine's connection pool, called on shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None


async def get_session() -> AsyncIterator[AsyncSession]:
    """Request-scoped unit of work: commit on success, roll back on error.

    The exception is an `AppError` marked `persist_effects`, which commits and
    still fails the request — see `AppError.persist_effects`.
    """
    from app.core.errors import AppError  # noqa: PLC0415 - avoids an import cycle
    from app.core.events import flush_pending  # noqa: PLC0415 - avoids an import cycle

    factory = get_session_factory()
    async with factory() as session:
        transaction = await session.begin()
        try:
            yield session
        except AppError as error:
            if error.persist_effects:
                await transaction.commit()
                await flush_pending(session)
            else:
                await transaction.rollback()
            raise
        except BaseException:
            await transaction.rollback()
            raise
        else:
            await transaction.commit()
            # Live updates go out here and nowhere else. Publishing inside a
            # service would wake a subscriber before the rows it is about to
            # read exist, and a rolled-back request would announce work that
            # never happened.
            await flush_pending(session)


# The one way to ask for the request's session. `scope="function"` ends the unit
# of work (commit or rollback) before the response is sent. FastAPI's default
# scope runs a yield dependency's exit code after the body has gone out, so a
# failed commit would follow a 200 the client already has, and the client's next
# request could read the database before the write landed. Every caller uses this
# alias: FastAPI caches dependencies per scope, so a second spelling would open a
# second session, and a second transaction, in the same request.
SessionDep = Annotated[AsyncSession, Depends(get_session, scope="function")]


@asynccontextmanager
async def job_session() -> AsyncIterator[AsyncSession]:
    """A unit of work for background tasks: commit on success, roll back on error.

    The request dependency cannot serve here: a task has no request.
    """
    from app.core.events import flush_pending  # noqa: PLC0415 - avoids an import cycle

    factory = get_session_factory()
    async with factory() as session, session.begin():
        yield session
    await flush_pending(session)


@asynccontextmanager
async def stream_session() -> AsyncIterator[AsyncSession]:
    """One snapshot's worth of reading, inside a stream that lives for minutes.

    A server-sent event stream cannot take the request session: that transaction
    would stay open for the life of the connection, holding a pooled connection
    and an open snapshot for as long as a tab stays open. So each snapshot opens
    its own short transaction.
    """
    factory = get_session_factory()
    async with factory() as session, session.begin():
        yield session


SessionOpener = Callable[[], AbstractAsyncContextManager[AsyncSession]]


def get_session_opener() -> SessionOpener:
    """How a stream opens each of its short transactions.

    A dependency, not a direct call, so a test can hand a stream its own
    transaction — a test's rows live in an uncommitted transaction that a
    separately-opened connection cannot see.
    """
    return stream_session


SessionOpenerDep = Annotated[SessionOpener, Depends(get_session_opener)]


def import_all_models() -> None:
    """Import every `app.features.<slice>.models` so `Base.metadata` is complete.

    Alembic autogenerate diffs the live schema against `Base.metadata`, and a
    table only reaches the metadata once its module has been imported.
    """
    features = importlib.import_module("app.features")
    for module_info in pkgutil.iter_modules(features.__path__):
        candidate = f"app.features.{module_info.name}.models"
        try:
            importlib.import_module(candidate)
        except ModuleNotFoundError as error:
            if error.name != candidate:
                raise


# --- the row boundary ------------------------------------------------------------------------------


def as_uuid(value: str | None) -> uuid.UUID | None:
    """The id as a UUID, or `None` for text that cannot name a row (so a lookup finds nothing).

    Ids arrive from URLs and bodies as text; the baseline answered a malformed
    one with "not found", never a database error, and so does this.
    """
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


def plain_value(value: Any) -> Any:
    """One column value in the JSON shape the baseline's PostgREST rows carried.

    UUIDs become text, timestamps and dates ISO text, and numerics floats (PostgREST
    sent `numeric` as a JSON number). The typed `*Row` models, the domain rules and
    the goldens were all written against that shape.
    """
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def plain_row(row: Row[Any]) -> dict[str, Any]:
    """A result row as a dict of column name to value, each made plain by `plain_value`."""
    return {str(name): plain_value(value) for name, value in row._mapping.items()}
