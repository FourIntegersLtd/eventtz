"""Resolve sanitized HTML + plain text for support-style message bodies."""

from __future__ import annotations

from dataclasses import dataclass

from app.features.chat.sanitize import message_plain_text, sanitize_message_html


@dataclass(frozen=True)
class ResolvedMessageContent:
    plain: str
    html: str | None


def resolve_message_content(
    *,
    message_body: str | None = None,
    message_body_html: str | None = None,
    default_plain: str = "",
) -> ResolvedMessageContent:
    """Sanitize optional HTML, derive plain text, and apply a default when both are empty."""
    body_html = sanitize_message_html(message_body_html) if message_body_html else ""
    plain = (message_body or "").strip()
    if body_html and not plain:
        plain = message_plain_text(body_html)
    if not plain and not body_html:
        plain = default_plain.strip()
    return ResolvedMessageContent(plain=plain, html=body_html or None)


def transactional_rich_body_fields(plain: str, body_html: str | None) -> dict[str, object]:
    """Template context keys for booking/notification-style rich message bodies."""
    if body_html:
        return {"body_html": body_html, "body_plain": plain, "body": None}
    return {"body": plain}
