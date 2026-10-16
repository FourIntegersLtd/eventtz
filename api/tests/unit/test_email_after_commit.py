"""Emails leave only after the transaction that caused them commits (`core.mail`).

Driven through the real `core.db.get_session` and `job_session`: a handler that
executes no SQL never opens a connection, so no database is needed to prove the
ordering.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.db import SessionDep, job_session
from app.core.mail import AfterCommitMailer
from app.core.ports import MailerDependency, OutgoingEmail, mailer_port
from tests.support.fakes import FakeMailer

WELCOME = OutgoingEmail(to=("client@example.com",), subject="Welcome", html="<p>Hi</p>", text="Hi")


class ExplodingMailer:
    """A mail provider whose client raises, to show a post-commit failure is swallowed."""

    def send(self, email: OutgoingEmail) -> bool:
        """Fail the way a broken HTTP client would."""
        raise RuntimeError("provider down")


def probe_app(delivery: object) -> FastAPI:
    """A two-route app on the real request session, delivering through `delivery`."""
    app = FastAPI()
    app.dependency_overrides[mailer_port] = lambda: delivery

    @app.post("/committed")
    async def committed(session: SessionDep, mailer: MailerDependency) -> dict[str, bool]:
        """Send, then succeed: the transaction commits."""
        mailer.send(WELCOME)
        return {"saved": True}

    @app.post("/rolled-back")
    async def rolled_back(session: SessionDep, mailer: MailerDependency) -> dict[str, bool]:
        """Send, then fail: the transaction rolls back."""
        mailer.send(WELCOME)
        raise RuntimeError("handler failed after sending")

    return app


@pytest.fixture
async def mailer_and_client() -> AsyncIterator[tuple[FakeMailer, AsyncClient]]:
    """The probe app on a fake mailer, with server errors returned as 500s instead of raised."""
    mailer = FakeMailer()
    transport = ASGITransport(app=probe_app(mailer), raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield mailer, client


async def test_a_committed_request_sends_exactly_one_email(
    mailer_and_client: tuple[FakeMailer, AsyncClient],
) -> None:
    mailer, client = mailer_and_client

    response = await client.post("/committed")

    assert response.status_code == 200
    assert mailer.sent == [WELCOME]


async def test_a_rolled_back_request_sends_no_email(
    mailer_and_client: tuple[FakeMailer, AsyncClient],
) -> None:
    mailer, client = mailer_and_client

    response = await client.post("/rolled-back")

    assert response.status_code == 500
    assert mailer.sent == []


async def test_a_refused_email_after_commit_still_returns_200() -> None:
    mailer = FakeMailer(accept=False)
    transport = ASGITransport(app=probe_app(mailer))
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/committed")

    assert response.status_code == 200
    assert mailer.sent == [WELCOME]


async def test_a_mail_provider_error_after_commit_still_returns_200() -> None:
    transport = ASGITransport(app=probe_app(ExplodingMailer()))
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/committed")

    assert response.status_code == 200


async def test_a_job_sends_after_commit_and_not_after_rollback() -> None:
    mailer = FakeMailer()

    async with job_session() as session:
        AfterCommitMailer(session, mailer).send(WELCOME)
        assert mailer.sent == []  # still queued while the transaction is open
    with pytest.raises(RuntimeError):
        async with job_session() as session:
            AfterCommitMailer(session, mailer).send(WELCOME)
            raise RuntimeError("job step failed after sending")

    assert mailer.sent == [WELCOME]
