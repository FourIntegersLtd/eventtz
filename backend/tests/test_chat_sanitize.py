"""Tests for support message HTML sanitization."""

from __future__ import annotations

import pytest

from app.features.chat.sanitize import (
    message_plain_text,
    message_plain_text_length,
    sanitize_message_html,
)
from app.features.chat.support_admin import _prepare_admin_support_body
from app.features.chat import messages as chat_messages


def test_sanitize_message_html_allows_inline_formatting():
    raw = "<p>Hello <strong>world</strong></p><script>alert(1)</script>"
    out = sanitize_message_html(raw)
    assert "<strong>world</strong>" in out
    assert "script" not in out


def test_sanitize_message_html_strips_headings_and_images():
    raw = "<h1>Title</h1><p>Hi</p><img src='https://evil.test/x.png' />"
    out = sanitize_message_html(raw)
    assert "h1" not in out
    assert "img" not in out
    assert "Hi" in out


def test_message_plain_text_strips_tags():
    assert message_plain_text("<p>Hello <em>there</em></p>") == "Hello there"


def test_prepare_admin_support_body_sets_html_metadata():
    html, meta = _prepare_admin_support_body("<p>Hello <strong>team</strong></p>")
    assert "<strong>team</strong>" in html
    assert meta == {"kind": "admin", "format": "html"}


def test_prepare_admin_support_body_rejects_empty():
    with pytest.raises(ValueError, match=chat_messages.MESSAGE_EMPTY):
        _prepare_admin_support_body("<p></p>")


def test_prepare_admin_support_body_rejects_over_limit():
    long_text = "a" * 5001
    with pytest.raises(ValueError, match="5000"):
        _prepare_admin_support_body(f"<p>{long_text}</p>")


def test_message_plain_text_length():
    assert message_plain_text_length("<p>abc</p>") == 3
