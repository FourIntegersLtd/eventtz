"""The Stripe webhook. Public: trusted by its signature, not by a signed-in user."""

from __future__ import annotations

from fastapi import APIRouter, Header, Request

from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency, PaymentGatewayDependency
from app.features.payments import service
from app.features.payments.errors import InvalidStripeSignature, MissingStripeSignature
from app.features.payments.schemas import StripeWebhookResponse

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post(
    "/stripe",
    response_model=StripeWebhookResponse,
    responses=error_responses(MissingStripeSignature, InvalidStripeSignature),
)
async def post_stripe_webhook(
    request: Request,
    session: SessionDep,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> StripeWebhookResponse:
    """Verify the signature over the raw body, then act on the event (at most once per event id)."""
    payload = await request.body()
    await service.handle_webhook(session, mailer, gateway, payload=payload, signature_header=stripe_signature)
    return StripeWebhookResponse()
