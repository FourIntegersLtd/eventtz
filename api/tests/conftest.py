"""Test wiring (copied from OSCE `platform-api`, ADR 0006).

- No in-memory store. Repository and HTTP tests run against a real Postgres.
- One database per test session, migrated once with Alembic.
- One transaction per test, rolled back at the end, so tests never see each
  other's rows and never need cleanup code.
- External services are fakes implementing `core.ports` protocols
  (`tests/support/fakes.py`).

Postgres comes from `TEST_DATABASE_URL` if set, otherwise from testcontainers
(needs a running Docker daemon). If neither is available, tests that use the
database are skipped with a message rather than failing — so check the summary
says they ran.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path

# Environment must be fixed before any app module reads settings.
os.environ["APP_ENV"] = "test"
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-not-for-production")
os.environ.setdefault("REDIS_DISABLED", "1")
# A developer's `.env` keys must not make a test talk to a real provider.
os.environ["OPENAI_API_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.db import (  # noqa: E402
    dispose_engine,
    get_engine,
    get_session,
    get_session_opener,
    sqlalchemy_url,
)
from app.core.settings import Settings, get_settings  # noqa: E402
from tests.support.fakes import FakePaymentGateway  # noqa: E402

API_ROOT = Path(__file__).resolve().parents[1]

# Pinned; keep in step with `docker-compose.yml`.
POSTGRES_IMAGE = "postgres:16"


# --------------------------------------------------------------------------
# Database lifecycle (session scope)
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """A Postgres to test against: `TEST_DATABASE_URL`, or a throwaway container."""
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        yield sqlalchemy_url(explicit)
        return
    try:
        from testcontainers.postgres import PostgresContainer  # noqa: PLC0415 - dev-only dependency

        container = PostgresContainer(POSTGRES_IMAGE, driver=None)
        container.start()
    except Exception as error:  # noqa: BLE001 - any reason Docker is unavailable
        pytest.skip(f"No Postgres for db tests (set TEST_DATABASE_URL or start Docker): {error}")
    try:
        yield sqlalchemy_url(container.get_connection_url())
    finally:
        container.stop()


@pytest.fixture(scope="session")
def migrated_database(database_url: str) -> str:
    """The test database at `alembic upgrade head`, the same path a deploy takes."""
    from alembic.config import Config  # noqa: PLC0415 - only db tests need Alembic

    from alembic import command  # noqa: PLC0415

    os.environ["DATABASE_URL"] = database_url
    get_settings.cache_clear()
    alembic_config = Config(str(API_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(API_ROOT / "alembic"))
    command.upgrade(alembic_config, "head")
    return database_url


@pytest_asyncio.fixture(scope="session")
async def _engine(migrated_database: str) -> AsyncIterator[None]:
    """The process-wide engine, pointed at the migrated test database."""
    get_engine()
    yield
    await dispose_engine()


# --------------------------------------------------------------------------
# Per-test transaction
# --------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db_session(_engine: None) -> AsyncIterator[AsyncSession]:
    """A session inside one outer transaction that is rolled back after the test.

    `create_savepoint` turns the code's own commits into savepoint releases, so
    the code under test behaves as in production and still leaves nothing behind.
    """
    engine = get_engine()
    async with engine.connect() as connection:
        outer_transaction = await connection.begin()
        session = AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield session
        finally:
            await session.close()
            await outer_transaction.rollback()


@pytest.fixture
def payment_gateway() -> FakePaymentGateway:
    """Stripe in memory: every HTTP test gets it, so no test can reach the real Stripe adapter."""
    return FakePaymentGateway()


@pytest_asyncio.fixture
async def app(db_session: AsyncSession, payment_gateway: FakePaymentGateway) -> FastAPI:
    """The real app, wired to the test's transaction and to the fake payment gateway."""
    from contextlib import asynccontextmanager  # noqa: PLC0415

    from app.core.ports import payment_gateway_port  # noqa: PLC0415 - settings must be fixed first
    from app.main import create_app  # noqa: PLC0415 - settings must be fixed first

    built = create_app()

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        """Mirror `core.db.get_session`, including `persist_effects` and the after-commit publish.

        If this diverged, a test could prove behaviour production does not have.
        """
        from app.core.errors import AppError  # noqa: PLC0415
        from app.core.events import flush_pending  # noqa: PLC0415
        from app.core.mail import discard_pending_emails, flush_pending_emails  # noqa: PLC0415

        try:
            yield db_session
        except AppError as error:
            if error.persist_effects:
                await db_session.commit()
                await flush_pending_emails(db_session)
                await flush_pending(db_session)
            else:
                await db_session.rollback()
                # The test's session outlives the request, so drop its queue as production's close does.
                discard_pending_emails(db_session)
            raise
        except Exception:
            await db_session.rollback()
            discard_pending_emails(db_session)
            raise
        else:
            await db_session.commit()  # releases the savepoint; the outer transaction stays open
            await flush_pending_emails(db_session)
            await flush_pending(db_session)

    @asynccontextmanager
    async def override_stream_session() -> AsyncIterator[AsyncSession]:
        """Lend a stream the test's own transaction, which a fresh connection could not see."""
        yield db_session

    built.dependency_overrides[get_session] = override_get_session
    built.dependency_overrides[get_session_opener] = lambda: override_stream_session
    built.dependency_overrides[payment_gateway_port] = lambda: payment_gateway
    return built


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """HTTP client whose requests share the test's transaction."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http


MakeActor = Callable[..., Awaitable[str]]


@pytest_asyncio.fixture
async def make_actor(db_session: AsyncSession) -> MakeActor:
    """Create a real `users` row and return a Bearer token for it.

    A token for an invented id is not a case production can reach: every
    request reads the account row, and audit rows have a foreign key to it.
    """
    from app.core.auth import issue_access_token  # noqa: PLC0415
    from app.features.identity import repository  # noqa: PLC0415

    async def make(
        email: str = "user@example.com",
        *,
        user_type: str = "client",
        admin_role: str | None = None,
        verified: bool = True,
        suspended: bool = False,
    ) -> str:
        """Write the account and mint its access token."""
        account_id = await repository.create_account(
            db_session,
            email=email,
            user_type=user_type,
            admin_role=admin_role,
            email_verified_at=datetime.now(UTC) if verified else None,
            account_suspended=suspended,
            terms_accepted_version=get_settings().terms_version,
            terms_accepted_at=datetime.now(UTC),
        )
        assert account_id is not None, f"an account with {email} already exists in this test"
        return issue_access_token(user_id=account_id, email=email, settings=get_settings())

    return make


@pytest.fixture
def settings() -> Settings:
    """The settings the app under test reads."""
    return get_settings()
