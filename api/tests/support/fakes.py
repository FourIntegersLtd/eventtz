"""In-memory stand-ins for the ports in `app.core.ports`. Tests plug them in; nothing is patched.

Each fake records what it was asked to do, so a test can assert on the prompt,
the email or the webhook exactly as the real adapter would have received it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel

from app.core.errors import AppError
from app.core.ports import ChatMessage, OutgoingEmail, ReplyModel, StoredFile, WebhookCall


@dataclass
class LanguageModelCall:
    """One `parse` call as the fake received it."""

    model: str
    messages: list[ChatMessage]
    reply_model: type[BaseModel]
    purpose: str


@dataclass
class FakeLanguageModel:
    """Answers every call with `reply` (a dict validated into the reply model), or raises `error`."""

    reply: dict[str, Any] | None = None
    error: Exception | None = None
    calls: list[LanguageModelCall] = field(default_factory=list)

    def parse(
        self, *, model: str, messages: list[ChatMessage], reply_model: type[ReplyModel], purpose: str
    ) -> ReplyModel:
        """Record the call, then raise the configured error or return the configured reply."""
        self.calls.append(
            LanguageModelCall(model=model, messages=messages, reply_model=reply_model, purpose=purpose)
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
        return StoredFile(bucket="fake-bucket", key=key, public_url=f"https://files.example/{key}")
