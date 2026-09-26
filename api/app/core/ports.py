"""The outside services a slice may use, as Protocols (the "ports").

A service never imports OpenAI, Resend or httpx directly. It receives a port as
an argument, and the router gets that port from a FastAPI dependency below:

    def ask(..., language_model: Annotated[LanguageModel, Depends(language_model_port)])

The real implementations live in `app/adapters/` and are plugged in by
`app.main.create_app()` through `app.dependency_overrides`. `core` never imports
an adapter. Tests plug in the fakes from `tests/support/fakes.py` the same way.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, Protocol, TypedDict, TypeVar

from fastapi import Depends
from pydantic import BaseModel

from app.core.errors import InvalidInput, Unavailable

# The reply model a structured language-model call is parsed into.
ReplyModel = TypeVar("ReplyModel", bound=BaseModel)


# --- language model ------------------------------------------------------------------


class ChatMessage(TypedDict):
    """One turn of a chat prompt, in the OpenAI message shape."""

    role: Literal["system", "user", "assistant"]
    content: str


class LanguageModelUnavailable(Unavailable):
    """No language model is configured (no API key), so AI features are switched off."""

    code = "ai_unavailable"
    default_message = "This AI feature isn't available right now. Please try again later."


class LanguageModelFailed(Unavailable):
    """The model was called but gave no usable answer (network error or unparseable reply)."""

    code = "ai_failed"
    default_message = "The help assistant is unavailable right now. Please try again later."


class LanguageModelEmptyReply(Unavailable):
    """The model answered but its structured reply was empty."""

    code = "ai_empty_reply"
    # No trailing full stop: verbatim from the baseline.
    default_message = "The help assistant returned an empty answer. Please try again"


class LanguageModelRefused(InvalidInput):
    """The model declined to answer (content policy refusal)."""

    code = "ai_refused"
    default_message = "I couldn't answer that. Try rephrasing, or contact support."


class LanguageModel(Protocol):
    """Ask a chat model for a reply that fits a Pydantic model (structured output)."""

    def parse(
        self, *, model: str, messages: list[ChatMessage], reply_model: type[ReplyModel], purpose: str
    ) -> ReplyModel:
        """Return the parsed reply.

        Raises `LanguageModelUnavailable` when no model is configured, and
        `LanguageModelFailed`, `LanguageModelRefused` or `LanguageModelEmptyReply`
        when the call does not produce an answer. `purpose` only labels log lines.
        """
        ...


# --- email ------------------------------------------------------------------------------


@dataclass(frozen=True)
class OutgoingEmail:
    """A rendered email ready to hand to the mail provider."""

    to: tuple[str, ...]
    subject: str
    html: str
    text: str | None = None


class Mailer(Protocol):
    """Send one email. Returns False (never raises) when it was skipped or refused."""

    def send(self, email: OutgoingEmail) -> bool:
        """Deliver `email`; False when email is switched off, has no recipients or the provider refuses."""
        ...


# --- outbound webhooks ------------------------------------------------------------------------


@dataclass(frozen=True)
class WebhookCall:
    """A JSON POST to a third-party automation endpoint."""

    url: str
    payload: dict[str, Any]
    headers: dict[str, str] = field(default_factory=dict)


class Webhooks(Protocol):
    """Fire-and-forget JSON webhooks. Never raises and never blocks the request."""

    def post_in_background(self, call: WebhookCall) -> None:
        """Queue `call`; failures are logged by the adapter, not reported to the caller."""
        ...


# --- file storage -------------------------------------------------------------------------------


@dataclass(frozen=True)
class StoredFile:
    """Where an uploaded file ended up."""

    bucket: str
    key: str
    public_url: str


class Storage(Protocol):
    """Public file storage for user uploads (an S3 bucket in production)."""

    def is_configured(self) -> bool:
        """False when storage is switched off (no credentials), so uploads should fail fast."""
        ...

    def save(self, *, key: str, body: bytes, content_type: str) -> StoredFile:
        """Store `body` under `key` as a public object. Raises on any storage failure."""
        ...

    def public_host(self) -> str:
        """The host every stored file's public URL starts with, so saved forms can keep only our uploads."""
        ...


# --- live updates -------------------------------------------------------------------------------


class EventBus(Protocol):
    """Fan-out for live updates, so a screen is told rather than asking (ADR 0005).

    Transport is Redis pub/sub with more than one API replica, in-process
    otherwise. Nothing durable goes through it: a subscriber that missed an
    event re-reads the read model on reconnect.
    """

    async def publish(self, topic: str, name: str) -> None:
        """Tell every subscriber to `topic` that `name` happened. Carries no payload."""
        ...

    def subscription(self, topics: Sequence[str]) -> AbstractAsyncContextManager[AsyncIterator[str]]:
        """Watch `topics`, yielding the name of each event published to them.

        A context manager, not a bare generator: the subscription is registered
        on entry, so no event published after entry can be missed.
        """
        ...


# --- dependencies the routers declare ----------------------------------------------------------


def language_model_port() -> LanguageModel:
    """Replaced by `create_app()` with the OpenAI adapter (and by tests with a fake)."""
    raise NotImplementedError("language_model_port is wired in app.main.create_app")


def mailer_port() -> Mailer:
    """Replaced by `create_app()` with the Resend adapter (and by tests with a fake)."""
    raise NotImplementedError("mailer_port is wired in app.main.create_app")


def webhooks_port() -> Webhooks:
    """Replaced by `create_app()` with the httpx adapter (and by tests with a fake)."""
    raise NotImplementedError("webhooks_port is wired in app.main.create_app")


def storage_port() -> Storage:
    """Replaced by `create_app()` with the S3 adapter (and by tests with a fake)."""
    raise NotImplementedError("storage_port is wired in app.main.create_app")


# What routers declare as a parameter type, e.g. `def ask(language_model: LanguageModelDependency)`.
LanguageModelDependency = Annotated[LanguageModel, Depends(language_model_port)]
MailerDependency = Annotated[Mailer, Depends(mailer_port)]
WebhooksDependency = Annotated[Webhooks, Depends(webhooks_port)]
StorageDependency = Annotated[Storage, Depends(storage_port)]
