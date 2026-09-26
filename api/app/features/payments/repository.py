"""Database access for payments: remembering which Stripe webhook events were handled.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionTransaction

from app.features.payments.models import StripeWebhookEvent


async def claim_webhook_event(session: AsyncSession, event_id: str, event_type: str) -> bool:
    """Record the event id; True the first time, False when Stripe is redelivering it.

    `ON CONFLICT DO NOTHING` makes the claim race-safe: two deliveries landing at once
    cannot both win, and the loser's transaction is not aborted by a key violation.
    """
    result = await session.execute(
        insert(StripeWebhookEvent)
        .values(id=event_id, type=event_type)
        .on_conflict_do_nothing(index_elements=[StripeWebhookEvent.id])
        .returning(StripeWebhookEvent.id)
    )
    return result.first() is not None


def webhook_handler_savepoint(session: AsyncSession) -> AsyncSessionTransaction:
    """A savepoint around one webhook handler.

    The webhook always answers 200 once the signature is valid (Stripe retries
    anything else), so a handler that fails half way must not leave half its writes
    behind to be committed with the event claim. Rolling back to the savepoint
    keeps the claim and discards the rest, as the baseline's failure did.
    """
    return session.begin_nested()
