"""Tests for shared message HTML/plain resolution."""

from app.features.chat.message_content import (
    resolve_message_content,
    transactional_rich_body_fields,
)


def test_resolve_message_content_from_html():
    content = resolve_message_content(
        message_body_html="<p>Hello <strong>world</strong></p>",
    )
    assert content.plain == "Hello world"
    assert content.html == "<p>Hello <strong>world</strong></p>"


def test_resolve_message_content_default_when_empty():
    content = resolve_message_content(default_plain="Fallback text")
    assert content.plain == "Fallback text"
    assert content.html is None


def test_transactional_rich_body_fields_plain_only():
    assert transactional_rich_body_fields("Hello", None) == {"body": "Hello"}


def test_transactional_rich_body_fields_with_html():
    fields = transactional_rich_body_fields("Hello", "<p><strong>Hello</strong></p>")
    assert fields == {
        "body_html": "<p><strong>Hello</strong></p>",
        "body_plain": "Hello",
        "body": None,
    }
