"""The one-off "we are updating our Terms" email, sent once per Terms version to every open account."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer
from app.core.settings import get_settings
from app.features.identity import service as identity
from app.features.notifications import service

# Accounts emailed per hourly pass; a large user base is covered over several passes.
TERMS_NOTICE_BATCH_SIZE = 200


async def send_terms_updated_notices(
    session: AsyncSession, mailer: Mailer, *, batch_size: int = TERMS_NOTICE_BATCH_SIZE
) -> int:
    """Email the next batch of accounts not yet told about the current Terms; returns how many were sent.

    An account is stamped once its email was handed to the mailer, or when it has no usable
    address (so it never blocks the queue). A failed send is left unstamped and retried next pass.
    """
    terms_version = get_settings().terms_version
    recipients = await identity.users_awaiting_terms_notice(session, terms_version, limit=batch_size)
    sent = 0
    finished_ids: list[str] = []
    for recipient in recipients:
        if service.send_terms_updated(mailer, email=recipient.email or "", terms_version=terms_version):
            sent += 1
            finished_ids.append(recipient.id)
        elif "@" not in (recipient.email or ""):
            finished_ids.append(recipient.id)
    await identity.mark_terms_notice_sent(session, finished_ids, terms_version)
    return sent
