"""`PaymentGateway` backed by Stripe's REST API over httpx.

No Stripe SDK: the dozen calls Eventtz makes are plain form-encoded POSTs and
GETs, and httpx is already a dependency. Stripe's form encoding nests with
brackets (`metadata[booking_id]=…`, `line_items[0][quantity]=1`), which
`_form_fields` produces from ordinary dicts and lists.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.logging import get_logger
from app.core.ports import CheckoutLink, PaymentGatewayError, PaymentsUnavailable
from app.core.settings import get_settings

log = get_logger(__name__)

STRIPE_API = "https://api.stripe.com/v1"
# Stripe answers most calls in well under a second; a slow one should fail the request, not hang it.
REQUEST_TIMEOUT_SECONDS = 20.0


def _form_fields(value: Any, prefix: str = "") -> list[tuple[str, str]]:
    """Flatten nested dicts/lists into Stripe's bracketed form fields, skipping None values."""
    if value is None:
        return []
    if isinstance(value, dict):
        fields: list[tuple[str, str]] = []
        for key, nested in value.items():
            fields.extend(_form_fields(nested, f"{prefix}[{key}]" if prefix else str(key)))
        return fields
    if isinstance(value, (list, tuple)):
        fields = []
        for position, nested in enumerate(value):
            fields.extend(_form_fields(nested, f"{prefix}[{position}]"))
        return fields
    if isinstance(value, bool):
        return [(prefix, "true" if value else "false")]
    return [(prefix, str(value))]


class StripePaymentGateway:
    """Calls Stripe with the configured secret key; raises `PaymentGatewayError` on any refusal."""

    def is_configured(self) -> bool:
        """True when a Stripe secret key is set."""
        return bool(get_settings().stripe_secret_key.strip())

    async def _call(
        self,
        method: str,
        path: str,
        *,
        fields: dict[str, Any] | None = None,
        expand: tuple[str, ...] = (),
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Send one request and return Stripe's JSON object."""
        secret_key = get_settings().stripe_secret_key.strip()
        if not secret_key:
            raise PaymentsUnavailable()
        form = _form_fields(fields or {})
        form.extend(("expand[]", name) for name in expand)
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else {}
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS, auth=(secret_key, "")) as http:
                if method == "GET":
                    query = f"?{urlencode(form)}" if form else ""
                    response = await http.get(f"{STRIPE_API}{path}{query}", headers=headers)
                else:
                    headers["Content-Type"] = "application/x-www-form-urlencoded"
                    response = await http.post(
                        f"{STRIPE_API}{path}", content=urlencode(form), headers=headers
                    )
        except httpx.HTTPError as error:
            log.warning("stripe request failed %s %s: %s", method, path, error)
            raise PaymentGatewayError() from error
        body: dict[str, Any] = response.json() if response.content else {}
        if response.status_code >= 400:
            raw_error = body.get("error")
            stripe_error: dict[str, Any] = raw_error if isinstance(raw_error, dict) else {}
            log.warning(
                "stripe refused %s %s status=%s code=%s: %s",
                method,
                path,
                response.status_code,
                stripe_error.get("code"),
                str(stripe_error.get("message") or "")[:300],
            )
            raise PaymentGatewayError(
                str(stripe_error.get("message") or "") or None,
                stripe_code=str(stripe_error.get("code") or ""),
                http_status=response.status_code,
            )
        return body

    async def create_checkout_session(
        self,
        *,
        amount_pence: int,
        description: str,
        metadata: dict[str, str],
        customer_email: str | None,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutLink:
        """Open a one-line GBP Checkout Session; the charge lands in Eventtz's own balance."""
        # No idempotency key: starting checkout takes no money, and a reused key
        # could hand back an old, expired link.
        session = await self._call(
            "POST",
            "/checkout/sessions",
            fields={
                "mode": "payment",
                "line_items": [
                    {
                        "price_data": {
                            "currency": "gbp",
                            "unit_amount": amount_pence,
                            "product_data": {"name": description[:500] or "Eventtz booking"},
                        },
                        "quantity": 1,
                    }
                ],
                "metadata": metadata,
                "payment_intent_data": {"metadata": metadata},
                "billing_address_collection": "required",
                "success_url": success_url,
                "cancel_url": cancel_url,
                "customer_email": customer_email,
            },
        )
        return CheckoutLink(session_id=str(session["id"]), url=str(session["url"]))

    async def retrieve_checkout_session(self, session_id: str) -> dict[str, Any]:
        """The session with its payment intent expanded."""
        return await self._call("GET", f"/checkout/sessions/{session_id}", expand=("payment_intent",))

    async def expire_checkout_session(self, session_id: str) -> None:
        """Close an open session."""
        await self._call("POST", f"/checkout/sessions/{session_id}/expire")

    async def retrieve_payment_intent(self, payment_intent_id: str) -> dict[str, Any]:
        """The payment intent with its latest charge expanded."""
        return await self._call("GET", f"/payment_intents/{payment_intent_id}", expand=("latest_charge",))

    async def retrieve_charge(self, charge_id: str) -> dict[str, Any]:
        """One charge."""
        return await self._call("GET", f"/charges/{charge_id}")

    async def create_refund(
        self,
        *,
        payment_intent_id: str,
        amount_pence: int | None,
        metadata: dict[str, str],
        idempotency_key: str,
    ) -> str:
        """Refund part or all of a payment; the key makes a retried refund a no-op."""
        refund = await self._call(
            "POST",
            "/refunds",
            fields={"payment_intent": payment_intent_id, "amount": amount_pence, "metadata": metadata},
            idempotency_key=idempotency_key,
        )
        return str(refund["id"])

    async def list_transfer_ids(self, transfer_group: str) -> list[str]:
        """Transfers already made for one booking's group."""
        listing = await self._call(
            "GET", "/transfers", fields={"transfer_group": transfer_group, "limit": 10}
        )
        return [str(transfer["id"]) for transfer in listing.get("data") or [] if transfer.get("id")]

    async def create_transfer(
        self,
        *,
        amount_pence: int,
        destination_account_id: str,
        transfer_group: str,
        metadata: dict[str, str],
        source_charge_id: str | None,
        idempotency_key: str,
    ) -> str:
        """Pay a connected account; `source_charge_id` funds it from the original charge."""
        transfer = await self._call(
            "POST",
            "/transfers",
            fields={
                "amount": amount_pence,
                "currency": "gbp",
                "destination": destination_account_id,
                "transfer_group": transfer_group,
                "metadata": metadata,
                "source_transaction": source_charge_id,
            },
            idempotency_key=idempotency_key,
        )
        return str(transfer["id"])

    async def create_express_account(
        self, *, email: str | None, individual: dict[str, Any], business_profile: dict[str, Any]
    ) -> str:
        """Open a UK Express account; prefill is only possible here, never by a later update."""
        account = await self._call(
            "POST",
            "/accounts",
            fields={
                "type": "express",
                "country": "GB",
                "email": email,
                "capabilities": {"card_payments": {"requested": True}, "transfers": {"requested": True}},
                "business_type": "individual",
                "business_profile": business_profile or None,
                "individual": individual or None,
            },
        )
        return str(account["id"])

    async def retrieve_account(self, account_id: str) -> dict[str, Any]:
        """One connected account."""
        return await self._call("GET", f"/accounts/{account_id}")

    async def retrieve_transfer(self, transfer_id: str) -> dict[str, Any]:
        """One transfer, for its `destination` connected account id."""
        return await self._call("GET", f"/transfers/{transfer_id}")

    async def create_account_link(self, *, account_id: str, refresh_url: str, return_url: str) -> str:
        """A one-time onboarding URL."""
        link = await self._call(
            "POST",
            "/account_links",
            fields={
                "account": account_id,
                "refresh_url": refresh_url,
                "return_url": return_url,
                "type": "account_onboarding",
            },
        )
        return str(link["url"])
