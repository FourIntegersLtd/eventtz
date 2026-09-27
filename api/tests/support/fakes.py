"""In-memory stand-ins for the ports in `app.core.ports`. Tests plug them in; nothing is patched.

Each fake records what it was asked to do, so a test can assert on the prompt,
the email or the webhook exactly as the real adapter would have received it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel

from app.core.errors import AppError
from app.core.ports import (
    ChatMessage,
    CheckoutLink,
    OutgoingEmail,
    PaymentGatewayError,
    PaymentsUnavailable,
    ReplyModel,
    StoredFile,
    WebhookCall,
)


@dataclass
class LanguageModelCall:
    """One `parse` call as the fake received it."""

    model: str
    messages: list[ChatMessage]
    reply_model: type[BaseModel]
    purpose: str
    image_data_url: str | None = None


@dataclass
class FakeLanguageModel:
    """Answers every call with `reply` (a dict validated into the reply model), or raises `error`."""

    reply: dict[str, Any] | None = None
    error: Exception | None = None
    calls: list[LanguageModelCall] = field(default_factory=list)

    def parse(
        self,
        *,
        model: str,
        messages: list[ChatMessage],
        reply_model: type[ReplyModel],
        purpose: str,
        image_data_url: str | None = None,
    ) -> ReplyModel:
        """Record the call, then raise the configured error or return the configured reply."""
        self.calls.append(
            LanguageModelCall(
                model=model,
                messages=messages,
                reply_model=reply_model,
                purpose=purpose,
                image_data_url=image_data_url,
            )
        )
        if self.error is not None:
            raise self.error
        if self.reply is None:
            raise AppError("FakeLanguageModel has no reply configured")
        return reply_model.model_validate(self.reply)


@dataclass
class FakeMailer:
    """Keeps every email instead of sending it; `accept=False` simulates the provider refusing."""

    accept: bool = True
    sent: list[OutgoingEmail] = field(default_factory=list)

    def send(self, email: OutgoingEmail) -> bool:
        """Record the email and report whether it was "delivered"."""
        self.sent.append(email)
        return self.accept


@dataclass
class FakeWebhooks:
    """Keeps every webhook instead of posting it."""

    posted: list[WebhookCall] = field(default_factory=list)

    def post_in_background(self, call: WebhookCall) -> None:
        """Record the call."""
        self.posted.append(call)


@dataclass
class SavedObject:
    """One object a `FakeStorage` was asked to save."""

    key: str
    body: bytes
    content_type: str


# The host every `FakeStorage` URL uses, so tests can build "our" upload URLs.
FAKE_STORAGE_HOST = "files.example"


@dataclass
class FakeStorage:
    """Keeps uploads in memory. `configured=False` simulates missing keys; `error` makes saves fail."""

    configured: bool = True
    error: Exception | None = None
    saved: list[SavedObject] = field(default_factory=list)

    def is_configured(self) -> bool:
        """Whether storage is "switched on"."""
        return self.configured

    def save(self, *, key: str, body: bytes, content_type: str) -> StoredFile:
        """Record the object (or raise `error`) and return a predictable public URL."""
        if self.error is not None:
            raise self.error
        self.saved.append(SavedObject(key=key, body=body, content_type=content_type))
        return StoredFile(bucket="fake-bucket", key=key, public_url=f"https://{FAKE_STORAGE_HOST}/{key}")

    def public_host(self) -> str:
        """The host of every URL `save` returns."""
        return FAKE_STORAGE_HOST


@dataclass
class PaymentCall:
    """One money-moving or state-changing call the fake gateway received."""

    name: str
    arguments: dict[str, Any]


@dataclass
class FakePaymentGateway:
    """Stripe in memory. Seed `objects` by id; every write is recorded in `calls`.

    `configured=False` behaves like a missing Stripe key. `error` makes the next
    call raise it (then clears, so a retry can succeed).
    """

    configured: bool = True
    error: Exception | None = None
    objects: dict[str, dict[str, Any]] = field(default_factory=dict)
    transfers_by_group: dict[str, list[str]] = field(default_factory=dict)
    calls: list[PaymentCall] = field(default_factory=list)

    def _enter(self, name: str, **arguments: Any) -> None:
        """Record the call, then fail like the real adapter would if told to."""
        if not self.configured:
            raise PaymentsUnavailable()
        self.calls.append(PaymentCall(name=name, arguments=arguments))
        if self.error is not None:
            error, self.error = self.error, None
            raise error

    def _object(self, object_id: str) -> dict[str, Any]:
        """A seeded Stripe object, or Stripe's `resource_missing` refusal."""
        if object_id not in self.objects:
            raise PaymentGatewayError("No such object", stripe_code="resource_missing", http_status=404)
        return self.objects[object_id]

    def is_configured(self) -> bool:
        """Whether a key is "set"."""
        return self.configured

    async def create_checkout_session(self, **arguments: Any) -> CheckoutLink:
        """A predictable session id per call."""
        self._enter("create_checkout_session", **arguments)
        session_id = f"cs_test_{len(self.calls)}"
        return CheckoutLink(session_id=session_id, url=f"https://checkout.example/{session_id}")

    async def retrieve_checkout_session(self, session_id: str) -> dict[str, Any]:
        """The seeded session."""
        self._enter("retrieve_checkout_session", session_id=session_id)
        return self._object(session_id)

    async def expire_checkout_session(self, session_id: str) -> None:
        """Record the expiry."""
        self._enter("expire_checkout_session", session_id=session_id)

    async def retrieve_payment_intent(self, payment_intent_id: str) -> dict[str, Any]:
        """The seeded payment intent."""
        self._enter("retrieve_payment_intent", payment_intent_id=payment_intent_id)
        return self._object(payment_intent_id)

    async def retrieve_charge(self, charge_id: str) -> dict[str, Any]:
        """The seeded charge."""
        self._enter("retrieve_charge", charge_id=charge_id)
        return self._object(charge_id)

    async def create_refund(self, **arguments: Any) -> str:
        """A refund id derived from the idempotency key, so a retry returns the same id."""
        self._enter("create_refund", **arguments)
        return f"re_{arguments['idempotency_key']}"

    async def list_transfer_ids(self, transfer_group: str) -> list[str]:
        """Transfers this fake already made for the group."""
        self._enter("list_transfer_ids", transfer_group=transfer_group)
        return list(self.transfers_by_group.get(transfer_group, []))

    async def create_transfer(self, **arguments: Any) -> str:
        """Record a transfer under its group."""
        self._enter("create_transfer", **arguments)
        transfer_id = f"tr_{len(self.calls)}"
        self.transfers_by_group.setdefault(arguments["transfer_group"], []).insert(0, transfer_id)
        return transfer_id

    async def create_express_account(self, **arguments: Any) -> str:
        """A fresh connected account, not yet enabled."""
        self._enter("create_express_account", **arguments)
        account_id = f"acct_{len(self.calls)}"
        self.objects[account_id] = {"id": account_id, "charges_enabled": False, "payouts_enabled": False}
        return account_id

    async def retrieve_account(self, account_id: str) -> dict[str, Any]:
        """The seeded account."""
        self._enter("retrieve_account", account_id=account_id)
        return self._object(account_id)

    async def create_account_link(self, *, account_id: str, refresh_url: str, return_url: str) -> str:
        """An onboarding URL naming the account."""
        self._enter(
            "create_account_link", account_id=account_id, refresh_url=refresh_url, return_url=return_url
        )
        return f"https://connect.example/{account_id}"

    async def retrieve_transfer(self, transfer_id: str) -> dict[str, Any]:
        """The seeded transfer."""
        self._enter("retrieve_transfer", transfer_id=transfer_id)
        return self._object(transfer_id)
