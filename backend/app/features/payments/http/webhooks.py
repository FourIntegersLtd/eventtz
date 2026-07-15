"""Stripe webhook endpoint. Public — verified by signature, not user login."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.logging import get_logger
from app.features.bookings.payments import (
    handle_account_updated,
    handle_checkout_session_completed,
)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = get_logger(__name__)


@router.post("/stripe")
async def post_stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, Any]:
    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header.")

    # Import here so the Stripe SDK is not loaded at startup when Stripe is not configured.
    from app.features.payments.stripe import construct_webhook_event, stripe_object_to_dict

    try:
        event = construct_webhook_event(payload, stripe_signature)
    except Exception as e:
        logger.warning(
            "Stripe webhook signature verification failed: %s "
            "(check STRIPE_WEBHOOK_SECRET matches the signing secret for this endpoint "
            "in Stripe Dashboard → Developers → Webhooks, and test vs live mode)",
            e,
        )
        raise HTTPException(status_code=400, detail="Invalid signature.") from e

    event_dict = stripe_object_to_dict(event)
    event_id = str(event_dict.get("id") or "")
    event_type = str(event_dict.get("type") or "")
    data_payload = event_dict.get("data")
    data_object = (
        data_payload.get("object")
        if isinstance(data_payload, dict) and isinstance(data_payload.get("object"), dict)
        else stripe_object_to_dict(
            getattr(getattr(event, "data", None), "object", None),
        )
    )

    # Always return 200 once the signature is valid — Stripe will retry on other status codes.
    # Duplicate events are ignored via the webhook-event table; handlers use conditional updates.
    try:
        if event_type == "checkout.session.completed":
            handle_checkout_session_completed(event_id, data_object)
        elif event_type == "account.updated":
            handle_account_updated(event_id, data_object)
        else:
            logger.debug("Unhandled Stripe webhook event type=%s id=%s", event_type, event_id)
    except Exception:
        logger.exception("Stripe webhook handler failed type=%s id=%s", event_type, event_id)

    return {"success": True}
