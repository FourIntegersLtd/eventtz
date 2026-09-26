"""Chat rules with no I/O: the HTML sanitiser, participants, read cursors, masking and message limits."""

from __future__ import annotations

import pytest

from app.features.messaging.domain import (
    client_peer_label,
    conversation_item,
    edited_metadata,
    message_item,
    messages_portal,
    read_cursor_column,
    role_in_conversation,
    staff_message_body,
    unique_recipient_ids,
    user_message_body,
)
from app.features.messaging.domain_sanitize import message_plain_text, sanitize_message_html
from app.features.messaging.errors import MessageEmpty, MessageTooLong
from app.features.messaging.rows import StoredMessageRow, ThreadRow

DM = ThreadRow(id="thread-1", kind="dm", client_user_id="client-1", vendor_user_id="vendor-1")
SUPPORT = ThreadRow(id="thread-2", kind="support", support_user_id="user-1")


def _message(sender_user_id: str) -> StoredMessageRow:
    """A stored message from `sender_user_id`."""
    return StoredMessageRow(
        id="message-1", conversation_id="thread-2", sender_user_id=sender_user_id, body="Hi", created_at=None
    )


def test_sanitiser_keeps_formatting_and_drops_scripts_headings_and_images() -> None:
    """Only simple formatting survives; the text inside dropped tags is kept, escaped."""
    assert (
        sanitize_message_html("<p>Hello <strong>world</strong></p><script>alert(1)</script>")
        == "<p>Hello <strong>world</strong></p>alert(1)"
    )
    assert sanitize_message_html("<h1>Title</h1><p>Hi</p><img src='https://evil.test/x.png' />") == (
        "Title<p>Hi</p>"
    )


def test_sanitiser_keeps_safe_links_only_and_closes_open_tags() -> None:
    """`javascript:` links lose their href; kept links get `rel=noopener`; unclosed tags are closed."""
    assert sanitize_message_html('<a href="javascript:alert(1)">x</a>') == "<a>x</a>"
    assert sanitize_message_html('<a href="https://eventtz.com" target="_blank">site</a>') == (
        '<a href="https://eventtz.com" rel="noopener noreferrer" target="_blank">site</a>'
    )
    assert sanitize_message_html("<p><em>open") == "<p><em>open</em></p>"


def test_plain_text_strips_tags_and_decodes_entities() -> None:
    """The visible text is what the length limit and email text use."""
    assert message_plain_text("<p>Hello <em>there</em></p>") == "Hello there"
    assert message_plain_text("<p>a &amp; b &lt;3</p>") == "a & b <3"


def test_staff_body_rejects_empty_and_over_limit_text() -> None:
    """Tags alone are empty; 5000 visible characters is the limit, however much markup surrounds them."""
    assert staff_message_body("  <p>Hello <strong>team</strong></p> ") == "<p>Hello <strong>team</strong></p>"
    with pytest.raises(MessageEmpty):
        staff_message_body("<p></p>")
    with pytest.raises(MessageTooLong):
        staff_message_body(f"<p>{'a' * 5001}</p>")
    assert staff_message_body(f"<p>{'a' * 5000}</p>") == f"<p>{'a' * 5000}</p>"


def test_user_body_is_trimmed_and_limited() -> None:
    """A typed message is trimmed; blank is empty; 5001 characters is too long."""
    assert user_message_body("  hello  ") == "hello"
    with pytest.raises(MessageEmpty):
        user_message_body("   ")
    with pytest.raises(MessageTooLong):
        user_message_body("a" * 5001)


def test_roles_and_read_cursors() -> None:
    """The support user reads with the client cursor; only the DM vendor uses the vendor cursor."""
    assert role_in_conversation(DM, "client-1") == "client"
    assert role_in_conversation(DM, "vendor-1") == "vendor"
    assert role_in_conversation(DM, "stranger") is None
    assert role_in_conversation(SUPPORT, "user-1") == "support_user"
    assert role_in_conversation(SUPPORT, "client-1") is None
    assert read_cursor_column("vendor") == "vendor_last_read_at"
    assert read_cursor_column("client") == "client_last_read_at"
    assert read_cursor_column("support_user") == "client_last_read_at"


def test_support_threads_show_eventtz_support_as_the_peer() -> None:
    """Whoever views a support thread, the peer is the fixed Eventtz Support identity."""
    item = conversation_item(SUPPORT, "user-1", peer_display_name="ignored", unread_count=2)
    assert item["peer_user_id"] == "eventtz-support"
    assert item["peer_display_name"] == "Eventtz Support"
    assert item["client_user_id"] == ""
    assert item["unread_count"] == 2
    dm_item = conversation_item(DM, "vendor-1", peer_display_name="Jane", unread_count=0)
    assert dm_item["peer_user_id"] == "client-1"
    assert dm_item["support_user_id"] is None


def test_staff_senders_are_masked_on_support_threads() -> None:
    """The user sees "Eventtz Admin", never the staff member's id; their own messages are unchanged."""
    staff_item = message_item(_message("admin-9"), support_user_id="user-1")
    assert staff_item["sender_user_id"] == "eventtz-admin"
    assert staff_item["sender_display_name"] == "Eventtz Admin"
    own_item = message_item(_message("user-1"), support_user_id="user-1")
    assert own_item["sender_user_id"] == "user-1"
    assert "sender_display_name" not in own_item
    assert message_item(_message("admin-9"), support_user_id=None)["sender_user_id"] == "admin-9"


def test_client_label_hides_staff_emails() -> None:
    """A staff account on the client side of a DM shows as "Eventtz Admin"; no name shows "Client"."""
    assert client_peer_label(user_type="admin", client_name="ops@example.com") == "Eventtz Admin"
    assert client_peer_label(user_type="client", client_name="Jane Doe") == "Jane Doe"
    assert client_peer_label(user_type="client", client_name=None) == "Client"


def test_edited_metadata_keeps_keys_and_stamps_the_time() -> None:
    """An edit keeps existing metadata, re-marks it as staff HTML and records when."""
    assert edited_metadata({"kind": "quote", "extra": 1}, edited_at="2026-09-26T10:00:00+00:00") == {
        "kind": "admin",
        "format": "html",
        "extra": 1,
        "edited_at": "2026-09-26T10:00:00+00:00",
    }
    assert edited_metadata(None, edited_at="t") == {"kind": "admin", "format": "html", "edited_at": "t"}


def test_recipients_are_unique_in_first_seen_order() -> None:
    """Named recipients come first; blanks and repeats across groups are dropped."""
    assert unique_recipient_ids([" a ", "b", ""], ["b", "c", "a"]) == ["a", "b", "c"]


def test_only_clients_and_vendors_have_a_messages_portal() -> None:
    """Support emails link into the recipient's own portal; staff have none."""
    assert messages_portal("client") == "client"
    assert messages_portal("vendor") == "vendor"
    assert messages_portal("admin") is None
    assert messages_portal(None) is None
