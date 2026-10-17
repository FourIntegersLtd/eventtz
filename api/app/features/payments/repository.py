"""Database access for payments: remembering which Stripe webhook events were handled.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

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
