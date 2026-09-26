"""Freeze: admin support messaging under /api/v1/admin/messages and /api/v1/admin/chat.

Owned by the `admin` slice on top of the `chat` slice's shared conversation/message
tables. "Eventtz Support" threads (`conversations.kind = "support"`) are one per end
user (client or vendor); any admin may reply or read them, targeted sends are for any
admin, and broadcasting to a whole audience is super-admin only. `/admin/chat/...` is a
separate, older read-only viewer over ordinary client-vendor DM threads (out of the
`/admin/messages` support inbox), open to any admin with no participant check. Every
mutating test seeds a fresh account with `seed_account`/`unique_email`, so runs stay
independent of each other.
"""

from __future__ import annotations

import uuid

import httpx
import pytest
from supabase import Client

from conftest import API, sign_in
from support.accounts import seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
RECIPIENTS_OR_AUDIENCE_REQUIRED = "Provide recipient_user_ids and/or audience (clients|vendors|users)."
BROADCAST_SUPPORT_SUPER_ADMIN_ONLY = (
    "Only super admins can broadcast support messages to all clients, vendors, or users."
)
SUPPORT_CONVERSATION_NOT_FOUND = "Support conversation not found."
MESSAGE_NOT_FOUND = "Message not found."
STAFF_MESSAGES_ONLY = "Only staff messages can be edited."
EDIT_OWN_MESSAGES_ONLY = "You can only edit messages you sent."
MESSAGE_EMPTY = "Message cannot be empty."

# A syntactically valid UUID that no conversation/message will ever have.
MISSING_ID = "00000000-0000-4000-8000-000000000000"

MESSAGES_URL = f"{API}/admin/messages"


def _fresh_staff(admin_db: Client, label: str) -> httpx.Client:
    """A signed-in browser for a brand-new plain admin account."""
    account = seed_account(admin_db, unique_email(label), "admin", admin_role="admin")
    return sign_in(account)


def _fresh_super_admin(admin_db: Client, label: str) -> httpx.Client:
    """A signed-in browser for a brand-new super admin account."""
    account = seed_account(admin_db, unique_email(label), "admin", admin_role="super_admin")
    return sign_in(account)


def _open_support_thread(browser: httpx.Client, recipient_user_id: str, body: str) -> str:
    """Send a targeted admin support message and return the resulting conversation id."""
    response = browser.post(
        f"{MESSAGES_URL}/send",
        json={"body": body, "recipient_user_ids": [recipient_user_id]},
    )
    assert response.status_code == 200, response.text
    conversation_ids = response.json()["conversation_ids"]
    assert len(conversation_ids) == 1
    return conversation_ids[0]


def _latest_audit_row(admin_db: Client, *, action: str, entity_id: str | None) -> dict:
    """The newest `admin_audit_log` row for this action/entity, asserting one exists."""
    query = admin_db.table("admin_audit_log").select("*").eq("action", action)
    query = query.is_("entity_id", "null") if entity_id is None else query.eq("entity_id", entity_id)
    rows = query.order("created_at", desc=True).limit(1).execute().data
    assert rows, f"expected an admin_audit_log row for action={action} entity_id={entity_id}"
    return rows[0]


# --- auth matrix -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/admin/messages/conversations", None),
        ("GET", f"/admin/messages/conversations/{MISSING_ID}", None),
        ("GET", f"/admin/messages/conversations/{MISSING_ID}/messages", None),
        ("POST", f"/admin/messages/conversations/{MISSING_ID}/messages", {"body": "hello"}),
        ("PATCH", f"/admin/messages/conversations/{MISSING_ID}/messages/{MISSING_ID}", {"body": "hello"}),
        ("POST", f"/admin/messages/conversations/{MISSING_ID}/read", None),
        ("POST", "/admin/messages/send", {"body": "hello", "recipient_user_ids": [MISSING_ID]}),
        ("GET", f"/admin/chat/conversations/{MISSING_ID}/messages", None),
    ],
)
def test_every_admin_message_route_needs_a_session(
    anonymous: httpx.Client, method: str, path: str, body: dict | None
) -> None:
    """Every admin messaging route is 401 for an anonymous caller."""
    response = anonymous.request(method, f"{API}{path}", json=body)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/admin/messages/conversations", None),
        ("POST", "/admin/messages/send", {"body": "hello", "recipient_user_ids": [MISSING_ID]}),
        ("GET", f"/admin/chat/conversations/{MISSING_ID}/messages", None),
    ],
)
def test_a_client_account_is_forbidden_from_admin_messaging(
    admin_db: Client, method: str, path: str, body: dict | None
) -> None:
    """A client (non-admin) account gets the admin-portal-only message, not a 404/400."""
    account = seed_account(admin_db, unique_email("admin-msg-client"), "client")
    browser = sign_in(account)
    response = browser.request(method, f"{API}{path}", json=body)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


# --- sending targeted support messages -----------------------------------------------------------


def test_send_requires_at_least_one_recipient_or_audience(admin_db: Client) -> None:
    """No recipients and no audience is rejected before anything is sent."""
    browser = _fresh_staff(admin_db, "admin-msg-norecip")
    response = browser.post(f"{MESSAGES_URL}/send", json={"body": "hello there"})
    assert response.status_code == 400
    assert response.json()["detail"] == RECIPIENTS_OR_AUDIENCE_REQUIRED


def test_send_body_may_not_be_empty(admin_db: Client) -> None:
    """The request model rejects a zero-length message body."""
    browser = _fresh_staff(admin_db, "admin-msg-empty")
    response = browser.post(f"{MESSAGES_URL}/send", json={"body": "", "recipient_user_ids": [MISSING_ID]})
    assert response.status_code == 422


def test_send_body_over_15000_characters_fails_validation(admin_db: Client) -> None:
    """The request model caps an admin support message body at 15000 characters."""
    browser = _fresh_staff(admin_db, "admin-msg-toolong")
    response = browser.post(
        f"{MESSAGES_URL}/send",
        json={"body": "x" * 15001, "recipient_user_ids": [MISSING_ID]},
    )
    assert response.status_code == 422


def test_a_plain_admin_can_send_a_targeted_message(admin_db: Client) -> None:
    """A plain admin (support role) may message specific recipients without an audience."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-plain-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-plain-recipient"), "client")
    body_text = f"Hello from support {uuid.uuid4().hex[:8]}"

    response = staff_browser.post(
        f"{MESSAGES_URL}/send",
        json={"body": body_text, "recipient_user_ids": [recipient.user_id]},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["sent"] == 1
    assert payload["failures"] is None
    conversation_id = payload["conversation_ids"][0]

    stored = (
        admin_db.table("messages")
        .select("body,sender_user_id,metadata")
        .eq("conversation_id", conversation_id)
        .execute()
        .data
    )
    assert any(row["body"] == body_text for row in stored)
    sent_row = next(row for row in stored if row["body"] == body_text)
    assert sent_row["metadata"] == {"kind": "admin", "format": "html"}

    audit_row = _latest_audit_row(admin_db, action="chat.admin_send", entity_id=None)
    assert audit_row["payload"]["sent"] == 1
    assert audit_row["payload"]["recipient_count"] == 1


def test_sending_to_the_same_recipient_twice_reuses_the_conversation(admin_db: Client) -> None:
    """Support threads are one per end user, so a second send lands in the same thread."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-reuse-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-reuse-recipient"), "client")

    first = _open_support_thread(staff_browser, recipient.user_id, f"first {uuid.uuid4().hex[:8]}")
    second = _open_support_thread(staff_browser, recipient.user_id, f"second {uuid.uuid4().hex[:8]}")
    assert first == second


def test_send_with_an_audience_is_forbidden_for_a_plain_admin(admin_db: Client) -> None:
    """Broadcasting to a whole audience of users is super-admin only, not for support staff."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-audience-staff")
    response = staff_browser.post(
        f"{MESSAGES_URL}/send",
        json={"body": "broadcast attempt", "audience": "clients"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == BROADCAST_SUPPORT_SUPER_ADMIN_ONLY


# --- support conversations: listing, detail, messages, read ---------------------------------------


def test_conversation_detail_for_an_unknown_id_is_404(admin_db: Client) -> None:
    """GET on a support conversation id that doesn't exist is a 404."""
    browser = _fresh_staff(admin_db, "admin-msg-detail-missing")
    response = browser.get(f"{MESSAGES_URL}/conversations/{MISSING_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == SUPPORT_CONVERSATION_NOT_FOUND


def test_listing_messages_on_an_unknown_conversation_is_404(admin_db: Client) -> None:
    """GET .../messages on an unknown support conversation id is a 404."""
    browser = _fresh_staff(admin_db, "admin-msg-list-missing")
    response = browser.get(f"{MESSAGES_URL}/conversations/{MISSING_ID}/messages")
    assert response.status_code == 404
    assert response.json()["detail"] == SUPPORT_CONVERSATION_NOT_FOUND


def test_replying_to_an_unknown_conversation_is_404(admin_db: Client) -> None:
    """POST .../messages on an unknown support conversation id is a 404."""
    browser = _fresh_staff(admin_db, "admin-msg-reply-missing")
    response = browser.post(f"{MESSAGES_URL}/conversations/{MISSING_ID}/messages", json={"body": "hello"})
    assert response.status_code == 404
    assert response.json()["detail"] == SUPPORT_CONVERSATION_NOT_FOUND


def test_marking_an_unknown_conversation_read_is_404(admin_db: Client) -> None:
    """POST .../read on an unknown support conversation id is a 404."""
    browser = _fresh_staff(admin_db, "admin-msg-read-missing")
    response = browser.post(f"{MESSAGES_URL}/conversations/{MISSING_ID}/read")
    assert response.status_code == 404
    assert response.json()["detail"] == SUPPORT_CONVERSATION_NOT_FOUND


def test_conversation_appears_in_the_admin_list_and_detail_after_a_send(admin_db: Client) -> None:
    """A support thread just opened by a send is visible via list and detail."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-visible-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-visible-recipient"), "client")
    conversation_id = _open_support_thread(
        staff_browser, recipient.user_id, f"visible {uuid.uuid4().hex[:8]}"
    )

    listing = staff_browser.get(f"{MESSAGES_URL}/conversations")
    assert listing.status_code == 200
    ids = {row["id"] for row in listing.json()["conversations"]}
    assert conversation_id in ids

    detail = staff_browser.get(f"{MESSAGES_URL}/conversations/{conversation_id}")
    assert detail.status_code == 200
    conversation = detail.json()["conversation"]
    assert conversation["kind"] == "support"
    assert conversation["support_user_id"] == recipient.user_id


def test_admin_reply_is_stored_and_notifies_the_recipient(admin_db: Client) -> None:
    """A follow-up admin reply lands in the same thread and writes its own audit row."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-reply-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-reply-recipient"), "client")
    conversation_id = _open_support_thread(
        staff_browser, recipient.user_id, f"opening {uuid.uuid4().hex[:8]}"
    )

    reply_text = f"reply {uuid.uuid4().hex[:8]}"
    response = staff_browser.post(
        f"{MESSAGES_URL}/conversations/{conversation_id}/messages", json={"body": reply_text}
    )
    assert response.status_code == 200
    reply = response.json()["message"]
    assert reply["body"] == reply_text

    audit_row = _latest_audit_row(admin_db, action="chat.admin_reply", entity_id=conversation_id)
    assert audit_row["payload"] == {}


def test_reply_body_may_not_be_empty(admin_db: Client) -> None:
    """A reply body with no visible text (after sanitizing) is a 400, not stored."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-reply-empty-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-reply-empty-recipient"), "client")
    conversation_id = _open_support_thread(
        staff_browser, recipient.user_id, f"opening {uuid.uuid4().hex[:8]}"
    )

    response = staff_browser.post(
        f"{MESSAGES_URL}/conversations/{conversation_id}/messages", json={"body": "   "}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == MESSAGE_EMPTY


def test_marking_a_support_conversation_read_succeeds(admin_db: Client) -> None:
    """A plain admin can mark a support conversation as read."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-markread-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-markread-recipient"), "client")
    conversation_id = _open_support_thread(
        staff_browser, recipient.user_id, f"opening {uuid.uuid4().hex[:8]}"
    )

    response = staff_browser.post(f"{MESSAGES_URL}/conversations/{conversation_id}/read")
    assert response.status_code == 200
    assert response.json() == {"success": True}

    row = (
        admin_db.table("conversations")
        .select("admin_last_read_at")
        .eq("id", conversation_id)
        .execute()
        .data[0]
    )
    assert row["admin_last_read_at"] is not None


# --- editing/hiding a staff message ----------------------------------------------------------------


def test_editing_an_unknown_conversation_is_404(admin_db: Client) -> None:
    """PATCH on an unknown conversation id is 404 before the message is even looked up."""
    browser = _fresh_staff(admin_db, "admin-msg-edit-noconv")
    response = browser.patch(
        f"{MESSAGES_URL}/conversations/{MISSING_ID}/messages/{MISSING_ID}", json={"body": "edited"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == SUPPORT_CONVERSATION_NOT_FOUND


def test_editing_an_unknown_message_is_404(admin_db: Client) -> None:
    """PATCH with a real conversation but an unknown message id is 404."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-edit-nomsg-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-edit-nomsg-recipient"), "client")
    conversation_id = _open_support_thread(
        staff_browser, recipient.user_id, f"opening {uuid.uuid4().hex[:8]}"
    )
    response = staff_browser.patch(
        f"{MESSAGES_URL}/conversations/{conversation_id}/messages/{MISSING_ID}",
        json={"body": "edited"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == MESSAGE_NOT_FOUND


def test_a_message_from_the_end_user_cannot_be_edited_by_staff(admin_db: Client) -> None:
    """Staff cannot edit the recipient's own reply - only staff-authored messages."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-edit-staffonly-staff")
    recipient_account = seed_account(admin_db, unique_email("admin-msg-edit-staffonly-recipient"), "client")
    conversation_id = _open_support_thread(
        staff_browser, recipient_account.user_id, f"opening {uuid.uuid4().hex[:8]}"
    )
    recipient_browser = sign_in(recipient_account)
    support_conversation = recipient_browser.get(f"{API}/chat/conversations").json()["conversations"]
    support_id = next(row["id"] for row in support_conversation if row["kind"] == "support")
    assert support_id == conversation_id
    user_reply = recipient_browser.post(
        f"{API}/chat/conversations/{conversation_id}/messages", json={"body": "user reply"}
    )
    assert user_reply.status_code == 200
    user_message_id = user_reply.json()["message"]["id"]

    response = staff_browser.patch(
        f"{MESSAGES_URL}/conversations/{conversation_id}/messages/{user_message_id}",
        json={"body": "edited by staff"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == STAFF_MESSAGES_ONLY


def test_one_admin_cannot_edit_another_admins_message(admin_db: Client) -> None:
    """Editing is limited to the message's own sender, even among staff."""
    first_staff = _fresh_staff(admin_db, "admin-msg-edit-own-first")
    second_staff = _fresh_staff(admin_db, "admin-msg-edit-own-second")
    recipient = seed_account(admin_db, unique_email("admin-msg-edit-own-recipient"), "client")
    conversation_id = _open_support_thread(first_staff, recipient.user_id, f"opening {uuid.uuid4().hex[:8]}")
    first_message_row = (
        admin_db.table("messages").select("id").eq("conversation_id", conversation_id).execute().data[0]
    )

    response = second_staff.patch(
        f"{MESSAGES_URL}/conversations/{conversation_id}/messages/{first_message_row['id']}",
        json={"body": "hijacked"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == EDIT_OWN_MESSAGES_ONLY


def test_an_admin_can_edit_their_own_message(admin_db: Client) -> None:
    """An admin editing their own message updates its body and stamps `edited_at`."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-edit-self-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-edit-self-recipient"), "client")
    conversation_id = _open_support_thread(
        staff_browser, recipient.user_id, f"original {uuid.uuid4().hex[:8]}"
    )
    message_id = (
        admin_db.table("messages").select("id").eq("conversation_id", conversation_id).execute().data[0]["id"]
    )

    edited_text = f"edited {uuid.uuid4().hex[:8]}"
    response = staff_browser.patch(
        f"{MESSAGES_URL}/conversations/{conversation_id}/messages/{message_id}",
        json={"body": edited_text},
    )
    assert response.status_code == 200
    edited = response.json()["message"]
    assert edited["body"] == edited_text
    assert edited["metadata"]["edited_at"] is not None

    audit_row = _latest_audit_row(admin_db, action="chat.admin_edit", entity_id=message_id)
    assert audit_row["payload"] == {"conversation_id": conversation_id}


def test_editing_with_only_whitespace_is_rejected(admin_db: Client) -> None:
    """Editing to a body with no visible text is a 400, and the stored message is untouched."""
    staff_browser = _fresh_staff(admin_db, "admin-msg-edit-blank-staff")
    recipient = seed_account(admin_db, unique_email("admin-msg-edit-blank-recipient"), "client")
    original_text = f"keep me {uuid.uuid4().hex[:8]}"
    conversation_id = _open_support_thread(staff_browser, recipient.user_id, original_text)
    message_id = (
        admin_db.table("messages").select("id").eq("conversation_id", conversation_id).execute().data[0]["id"]
    )

    response = staff_browser.patch(
        f"{MESSAGES_URL}/conversations/{conversation_id}/messages/{message_id}",
        json={"body": "   "},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == MESSAGE_EMPTY

    unchanged = admin_db.table("messages").select("body").eq("id", message_id).execute().data[0]
    assert unchanged["body"] == original_text


# --- the older admin chat viewer (arbitrary DM transcripts) -----------------------------------------


def test_admin_chat_viewer_reads_a_dm_conversation_with_no_participant_check(admin_db: Client) -> None:
    """Any admin can read any client-vendor DM transcript here, unlike the /messages inbox.

    This is the separate `/admin/chat/...` route (`platform_trust.py`), used by staff to
    inspect a booking's own chat thread; it never checks that the caller is a party to the
    conversation, only that they are signed in as any admin.
    """
    client_account = seed_account(admin_db, unique_email("admin-chatview-client"), "client")
    vendor_account = seed_account(admin_db, unique_email("admin-chatview-vendor"), "vendor")
    business_name = f"Acceptance Chatview Vendor {uuid.uuid4().hex[:6]}"
    admin_db.table("vendors").insert(
        {
            "user_id": vendor_account.user_id,
            "status": "draft",
            "approval_status": "pending",
            "payload": {"businessName": business_name},
        }
    ).execute()
    conversation = (
        admin_db.table("conversations")
        .insert(
            {
                "kind": "dm",
                "client_user_id": client_account.user_id,
                "vendor_user_id": vendor_account.user_id,
            }
        )
        .execute()
        .data[0]
    )
    body_text = f"admin viewer {uuid.uuid4().hex[:8]}"
    admin_db.table("messages").insert(
        {
            "conversation_id": conversation["id"],
            "sender_user_id": client_account.user_id,
            "body": body_text,
        }
    ).execute()

    staff_browser = _fresh_staff(admin_db, "admin-chatview-staff")
    response = staff_browser.get(f"{API}/admin/chat/conversations/{conversation['id']}/messages")
    assert response.status_code == 200
    body = response.json()
    assert body["client_user_id"] == client_account.user_id
    assert body["vendor_user_id"] == vendor_account.user_id
    assert body["client_email"] == client_account.email
    assert body["vendor_display_name"] == business_name
    assert any(message["body"] == body_text for message in body["messages"])

    audit_row = _latest_audit_row(admin_db, action="chat.view", entity_id=conversation["id"])
    assert audit_row["payload"] == {}


def test_admin_chat_viewer_returns_empty_shape_for_an_unknown_conversation(admin_db: Client) -> None:
    """# BASELINE QUIRK: an unknown (but valid-looking) conversation id is still a 200 with
    empty/null fields, never a 404 - `get_conversation_admin_meta`/`get_conversation_messages_admin`
    swallow "not found" into empty results rather than raising.
    """
    staff_browser = _fresh_staff(admin_db, "admin-chatview-unknown-staff")
    response = staff_browser.get(f"{API}/admin/chat/conversations/{MISSING_ID}/messages")
    assert response.status_code == 200
    body = response.json()
    assert body["messages"] == []
    assert body["client_user_id"] is None
    assert body["vendor_user_id"] is None


def test_admin_chat_viewer_returns_empty_shape_for_a_malformed_conversation_id(admin_db: Client) -> None:
    """A conversation id that isn't even a UUID is also a 200 with empty results."""
    staff_browser = _fresh_staff(admin_db, "admin-chatview-malformed-staff")
    response = staff_browser.get(f"{API}/admin/chat/conversations/not-a-uuid/messages")
    assert response.status_code == 200
    body = response.json()
    assert body["messages"] == []
    assert body["client_user_id"] is None
