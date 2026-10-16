"""Emails leave only after the transaction that caused them commits.

An email cannot be unsent. Sent inside the request (or job) transaction, it would
describe a change that a later failure, or a failed commit, rolls back. So the
`Mailer` that services receive is an `AfterCommitMailer`: `send` queues the
rendered email on the session, and `core.db` hands the queue to the real adapter
once the commit has succeeded. A rolled-back transaction drops the queue unsent.

The same shape as `core.events.publish_after_commit`, which defers live updates.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer, OutgoingEmail

log = get_logger(__name__)

# Where a unit of work's queued emails wait on `session.info` until it commits.
PENDING_EMAILS_KEY = "pending_emails"


class AfterCommitMailer:
    """A `Mailer` that queues each email on `session` for `flush_pending_emails` to send.

    `send` returns True, meaning "accepted for delivery after commit": the
    provider's answer does not exist yet. A caller whose response must report
    the provider's answer takes the adapter itself (`ImmediateMailerDependency`).
    """

    def __init__(self, session: AsyncSession, delivery: Mailer) -> None:
        """Queue on `session`; deliver through `delivery` (the real adapter) after commit."""
        self._session = session
        self._delivery = delivery

    def send(self, email: OutgoingEmail) -> bool:
        """Queue `email` to go out once this session's transaction commits."""
        self._session.info.setdefault(PENDING_EMAILS_KEY, []).append((self._delivery, email))
        return True


async def flush_pending_emails(session: AsyncSession) -> None:
    """Send what the committed transaction queued. Called by `core.db` only.

    A refusal or an error is logged and swallowed: the write is committed, and a
    lost email must not turn the request's success into a 500 (each sender
    already logged and continued when the provider refused, before deferral).
    """
    pending: list[tuple[Mailer, OutgoingEmail]] = session.info.pop(PENDING_EMAILS_KEY, [])
    for delivery, email in pending:
        try:
            if not delivery.send(email):
                log.warning("email refused after commit subject=%s", email.subject)
        except Exception:
            log.exception("email could not be sent after commit subject=%s", email.subject)


def discard_pending_emails(session: AsyncSession) -> None:
    """Drop the queue unsent, for a rolled-back transaction whose session lives on (tests)."""
    session.info.pop(PENDING_EMAILS_KEY, None)
