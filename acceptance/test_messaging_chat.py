"""Freeze: client/vendor chat under /api/v1/chat (conversations, messages, unread, read).

Owned by the `chat` slice. DM conversations pair one client and one vendor; a client
may only open one with a vendor that is publicly bookable (approved and either Stripe
verified or admin-waived); a vendor may only open one with a client they already have a
booking with. Support conversations (one per end user, `kind="support"`) are covered by
`test_messaging_admin.py` from the staff side. Every mutating test seeds fresh accounts
with `seed_account`/`unique_email`, so runs stay independent of each other.
"""

from __future__ import annotations

import uuid

import httpx
import pytest
from support.database import LocalDatabase

from conftest import API, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CHAT_PORTAL_ONLY = "Chat is only available for client and vendor accounts."
CLIENT_BOOKINGS_ONLY = "You can only message clients you have bookings with."
CONVERSATION_NOT_FOUND = "Conversation not found."
VENDOR_NOT_FOUND = "Vendor not found."
NOT_VENDOR_ACCOUNT = "That user is not a vendor account."
VENDOR_UNAVAILABLE = "This vendor is not available for messages."
NOT_IN_CONVERSATION = "You are not part of this conversation."
MESSAGE_EMPTY = "Message cannot be empty."

# A syntactically valid UUID that no user or conversation will ever have.
MISSING_ID = "00000000-0000-4000-8000-000000000000"


def _friendly_name_from_email(email: str) -> str:
    """Mirror `_friendly_name_from_email`: the fallback client label shown to a vendor."""
    local = email.split("@", 1)[0].strip()
    words = [word for word in local.replace(".", " ").replace("_", " ").replace("-", " ").split() if word]
    cleaned = " ".join(word.capitalize() for word in words if not word.isdigit())
    return cleaned or "Client"


def _seed_bookable_vendor(admin_db: LocalDatabase, label: str) -> SeededAccount:
    """A fresh vendor account, approved and listing-waived so a client may message it."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": "submitted",
            "approval_status": "approved",
            "listing_override": "visible",
            "payload": {},
        }
    ).execute()
    return account


def _seed_booking(admin_db: LocalDatabase, client_user_id: str, vendor_user_id: str) -> str:
    """A booking request linking `client_user_id` and `vendor_user_id`. Returns its id."""
    inserted = (
        admin_db.table("booking_requests")
        .insert(
            {
                "client_user_id": client_user_id,
                "vendor_user_id": vendor_user_id,
                "event_name": "Acceptance chat booking",
                "event_date": "2099-01-01",
                "total_label": "£100",
            }
        )
        .execute()
    )
    return str(inserted.data[0]["id"])


def _create_dm(browser: httpx.Client, peer_user_id: str) -> dict:
    """POST /chat/conversations and return the resulting conversation, asserting success."""
    response = browser.post(f"{API}/chat/conversations", json={"peer_user_id": peer_user_id})
    assert response.status_code == 200, response.text
    return response.json()["conversation"]


# --- auth matrix -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/chat/unread-count", None),
        ("GET", "/chat/conversations", None),
        ("POST", "/chat/conversations", {"peer_user_id": MISSING_ID}),
        ("GET", f"/chat/conversations/{MISSING_ID}", None),
        ("GET", f"/chat/conversations/{MISSING_ID}/messages", None),
        ("POST", f"/chat/conversations/{MISSING_ID}/messages", {"body": "hello"}),
        ("POST", f"/chat/conversations/{MISSING_ID}/read", None),
    ],
)
def test_every_chat_route_needs_a_session(
    anonymous: httpx.Client, method: str, path: str, body: dict | None
) -> None:
    """Every chat route is 401 for an anonymous caller, with the same message.

    Bodies must satisfy the request model, or FastAPI's own 422 fires before the
    handler's `require_user` call - which would freeze the wrong status code.
    """
    response = anonymous.request(method, f"{API}{path}", json=body)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_staff_cannot_list_conversations(admin_db: LocalDatabase) -> None:
    """An admin account is not a chat portal: listing conversations is 403, not empty."""
    account = seed_account(admin_db, unique_email("chat-staff-list"), "admin", admin_role="admin")
    browser = sign_in(account)
    response = browser.get(f"{API}/chat/conversations")
    assert response.status_code == 403
    assert response.json()["detail"] == CHAT_PORTAL_ONLY


def test_staff_cannot_open_a_dm_conversation_by_creating_one(admin_db: LocalDatabase) -> None:
    """An admin account cannot create a DM either - same portal-only message."""
    account = seed_account(admin_db, unique_email("chat-staff-create"), "admin", admin_role="admin")
    browser = sign_in(account)
    response = browser.post(f"{API}/chat/conversations", json={"peer_user_id": MISSING_ID})
    assert response.status_code == 403
    assert response.json()["detail"] == CHAT_PORTAL_ONLY


def test_staff_viewing_someone_elses_conversation_is_404_not_403(admin_db: LocalDatabase) -> None:
    """Staff are not chat participants, so GET .../{id} is a plain 404, not a portal 403.

    # BASELINE QUIRK: `get_conversation`/`get_messages`/`mark_read` only check whether the
    # caller is a participant of that one conversation id - they never check user_type - so
    # an admin (or any signed-in stranger) sees "Conversation not found" rather than a
    # portal-forbidden message, unlike list/create which do check user_type first.
    """
    client_account = seed_account(admin_db, unique_email("chat-quirk-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-quirk-vendor")
    client_browser = sign_in(client_account)
    conversation = _create_dm(client_browser, vendor_account.user_id)

    staff_account = seed_account(admin_db, unique_email("chat-quirk-staff"), "admin", admin_role="admin")
    staff_browser = sign_in(staff_account)
    response = staff_browser.get(f"{API}/chat/conversations/{conversation['id']}")
    assert response.status_code == 404
    assert response.json()["detail"] == CONVERSATION_NOT_FOUND


# --- who may open a conversation with whom ----------------------------------------------------


def test_peer_user_id_may_not_be_blank(as_client: httpx.Client) -> None:
    """The request model rejects an empty peer id before any lookup happens."""
    response = as_client.post(f"{API}/chat/conversations", json={"peer_user_id": ""})
    assert response.status_code == 422


def test_client_cannot_message_an_unknown_vendor_id(as_client: httpx.Client) -> None:
    """A peer id that isn't any user at all is rejected as vendor-not-found."""
    response = as_client.post(f"{API}/chat/conversations", json={"peer_user_id": MISSING_ID})
    assert response.status_code == 400
    assert response.json()["detail"] == VENDOR_NOT_FOUND


def test_client_cannot_message_another_client_as_if_it_were_a_vendor(
    admin_db: LocalDatabase, as_client: httpx.Client
) -> None:
    """A peer id that is a real user but not a vendor account is rejected."""
    other_client = seed_account(admin_db, unique_email("chat-peer-client"), "client")
    response = as_client.post(f"{API}/chat/conversations", json={"peer_user_id": other_client.user_id})
    assert response.status_code == 400
    assert response.json()["detail"] == NOT_VENDOR_ACCOUNT


def test_client_cannot_message_a_vendor_not_publicly_bookable(
    admin_db: LocalDatabase, as_client: httpx.Client
) -> None:
    """A vendor with no approved, bookable listing cannot be messaged by a client."""
    vendor = seed_account(admin_db, unique_email("chat-unbookable"), "vendor")
    admin_db.table("vendors").insert(
        {
            "user_id": vendor.user_id,
            "status": "draft",
            "approval_status": "pending",
            "payload": {},
        }
    ).execute()
    response = as_client.post(f"{API}/chat/conversations", json={"peer_user_id": vendor.user_id})
    assert response.status_code == 400
    assert response.json()["detail"] == VENDOR_UNAVAILABLE


def test_client_can_open_a_dm_with_a_bookable_vendor(admin_db: LocalDatabase) -> None:
    """A fresh client opens a DM with an approved, listing-waived vendor."""
    client_account = seed_account(admin_db, unique_email("chat-open-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-open-vendor")
    browser = sign_in(client_account)

    conversation = _create_dm(browser, vendor_account.user_id)
    assert conversation["kind"] == "dm"
    assert conversation["client_user_id"] == client_account.user_id
    assert conversation["vendor_user_id"] == vendor_account.user_id
    assert conversation["peer_user_id"] == vendor_account.user_id
    # No businessName on the seeded payload, so the vendor falls back to a plain label.
    assert conversation["peer_display_name"] == "Vendor"
    assert conversation["unread_count"] == 0


def test_opening_the_same_dm_twice_returns_the_same_conversation(admin_db: LocalDatabase) -> None:
    """A second POST for the same client/vendor pair is idempotent, not a duplicate row."""
    client_account = seed_account(admin_db, unique_email("chat-idem-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-idem-vendor")
    browser = sign_in(client_account)

    first = _create_dm(browser, vendor_account.user_id)
    second = _create_dm(browser, vendor_account.user_id)
    assert first["id"] == second["id"]


def test_vendor_cannot_message_a_client_with_no_booking(admin_db: LocalDatabase) -> None:
    """A vendor may only open a DM with a client they have a booking relationship with."""
    vendor_account = seed_account(admin_db, unique_email("chat-vendor-nobooking"), "vendor")
    client_account = seed_account(admin_db, unique_email("chat-client-nobooking"), "client")
    browser = sign_in(vendor_account)
    response = browser.post(f"{API}/chat/conversations", json={"peer_user_id": client_account.user_id})
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_BOOKINGS_ONLY


def test_vendor_can_message_a_client_with_a_booking(admin_db: LocalDatabase) -> None:
    """A vendor with a real booking may open a DM with that client, even while unapproved.

    # BASELINE BUG: `get_or_create_conversation` always builds the *creation* response
    # from the client's point of view (it hardcodes `client_user_id` as the viewer when
    # shaping the returned row), so a vendor-initiated create response reports itself
    # (`peer_user_id`/`peer_display_name` = the vendor, not the client) - the opposite of
    # what the vendor asked for. A subsequent GET on the same conversation id is correct
    # (see `test_vendor_sees_the_client_as_peer_after_a_fresh_get`), so this only bites the
    # create response's shape, not the stored row or later reads.
    """
    vendor_account = seed_account(admin_db, unique_email("chat-vendor-booking"), "vendor")
    client_account = seed_account(admin_db, unique_email("chat-client-booking"), "client")
    _seed_booking(admin_db, client_account.user_id, vendor_account.user_id)
    browser = sign_in(vendor_account)

    conversation = _create_dm(browser, client_account.user_id)
    assert conversation["kind"] == "dm"
    assert conversation["client_user_id"] == client_account.user_id
    assert conversation["vendor_user_id"] == vendor_account.user_id
    assert conversation["peer_user_id"] == vendor_account.user_id
    assert conversation["peer_display_name"] == "Vendor"


def test_vendor_sees_the_client_as_peer_after_a_fresh_get(admin_db: LocalDatabase) -> None:
    """Once loaded back via GET, the vendor correctly sees the client as their peer."""
    vendor_account = seed_account(admin_db, unique_email("chat-vendor-getpeer"), "vendor")
    client_account = seed_account(admin_db, unique_email("chat-client-getpeer"), "client")
    _seed_booking(admin_db, client_account.user_id, vendor_account.user_id)
    browser = sign_in(vendor_account)
    created = _create_dm(browser, client_account.user_id)

    detail = browser.get(f"{API}/chat/conversations/{created['id']}")
    assert detail.status_code == 200
    conversation = detail.json()["conversation"]
    assert conversation["peer_user_id"] == client_account.user_id
    assert conversation["peer_display_name"] == _friendly_name_from_email(client_account.email)


# --- participants-only access -------------------------------------------------------------------


def test_a_stranger_client_gets_404_on_someone_elses_conversation(admin_db: LocalDatabase) -> None:
    """A signed-in client who is not on the conversation gets 404, not the peer's data."""
    client_account = seed_account(admin_db, unique_email("chat-owner-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-owner-vendor")
    conversation = _create_dm(sign_in(client_account), vendor_account.user_id)

    stranger = seed_account(admin_db, unique_email("chat-stranger"), "client")
    response = sign_in(stranger).get(f"{API}/chat/conversations/{conversation['id']}")
    assert response.status_code == 404
    assert response.json()["detail"] == CONVERSATION_NOT_FOUND


def test_getting_an_unknown_conversation_id_is_404(as_client: httpx.Client) -> None:
    """A syntactically valid but non-existent conversation id is a 404."""
    response = as_client.get(f"{API}/chat/conversations/{MISSING_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == CONVERSATION_NOT_FOUND


def test_listing_messages_on_someone_elses_conversation_is_404(admin_db: LocalDatabase) -> None:
    """Reading messages on a conversation you are not part of is also a 404."""
    client_account = seed_account(admin_db, unique_email("chat-msg-owner"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-msg-vendor")
    conversation = _create_dm(sign_in(client_account), vendor_account.user_id)

    stranger = seed_account(admin_db, unique_email("chat-msg-stranger"), "client")
    response = sign_in(stranger).get(f"{API}/chat/conversations/{conversation['id']}/messages")
    assert response.status_code == 404
    assert response.json()["detail"] == CONVERSATION_NOT_FOUND


def test_sending_a_message_on_someone_elses_conversation_is_400_not_404(admin_db: LocalDatabase) -> None:
    """# BASELINE QUIRK: posting to a conversation you're not part of is 400 ("not part of
    this conversation"), unlike GET on the same id which is 404 ("Conversation not found").
    `send_message` raises `ValueError` (mapped to 400 by the route) instead of the
    `NotFoundError`/`ForbiddenError` the read-side helpers use.
    """
    client_account = seed_account(admin_db, unique_email("chat-send-owner"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-send-vendor")
    conversation = _create_dm(sign_in(client_account), vendor_account.user_id)

    stranger = seed_account(admin_db, unique_email("chat-send-stranger"), "client")
    response = sign_in(stranger).post(
        f"{API}/chat/conversations/{conversation['id']}/messages", json={"body": "hello"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == NOT_IN_CONVERSATION


def test_sending_a_message_to_an_unknown_conversation_is_400(as_client: httpx.Client) -> None:
    """Posting a message to a conversation id that doesn't exist is 400, not 404."""
    response = as_client.post(f"{API}/chat/conversations/{MISSING_ID}/messages", json={"body": "hello"})
    assert response.status_code == 400
    assert response.json()["detail"] == CONVERSATION_NOT_FOUND


def test_marking_someone_elses_conversation_read_is_403(admin_db: LocalDatabase) -> None:
    """Marking read on a conversation you're not part of is 403 (ForbiddenError), not 400/404."""
    client_account = seed_account(admin_db, unique_email("chat-read-owner"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-read-vendor")
    conversation = _create_dm(sign_in(client_account), vendor_account.user_id)

    stranger = seed_account(admin_db, unique_email("chat-read-stranger"), "client")
    response = sign_in(stranger).post(f"{API}/chat/conversations/{conversation['id']}/read")
    assert response.status_code == 403
    assert response.json()["detail"] == NOT_IN_CONVERSATION


def test_marking_an_unknown_conversation_read_is_404(as_client: httpx.Client) -> None:
    """Marking read on an unknown conversation id is a 404 (NotFoundError)."""
    response = as_client.post(f"{API}/chat/conversations/{MISSING_ID}/read")
    assert response.status_code == 404
    assert response.json()["detail"] == CONVERSATION_NOT_FOUND


# --- message validation ------------------------------------------------------------------------


def test_an_empty_message_body_fails_validation(admin_db: LocalDatabase) -> None:
    """The request model itself rejects a zero-length body."""
    client_account = seed_account(admin_db, unique_email("chat-empty-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-empty-vendor")
    conversation = _create_dm(sign_in(client_account), vendor_account.user_id)
    browser = sign_in(client_account)
    response = browser.post(f"{API}/chat/conversations/{conversation['id']}/messages", json={"body": ""})
    assert response.status_code == 422


def test_a_whitespace_only_message_is_rejected_after_stripping(admin_db: LocalDatabase) -> None:
    """A body of only whitespace passes the model but fails the service-level check."""
    client_account = seed_account(admin_db, unique_email("chat-blank-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-blank-vendor")
    conversation = _create_dm(sign_in(client_account), vendor_account.user_id)
    browser = sign_in(client_account)
    response = browser.post(f"{API}/chat/conversations/{conversation['id']}/messages", json={"body": "     "})
    assert response.status_code == 400
    assert response.json()["detail"] == MESSAGE_EMPTY


def test_a_message_over_5000_characters_fails_validation(admin_db: LocalDatabase) -> None:
    """The request model caps a chat message body at 5000 characters."""
    client_account = seed_account(admin_db, unique_email("chat-long-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-long-vendor")
    conversation = _create_dm(sign_in(client_account), vendor_account.user_id)
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/chat/conversations/{conversation['id']}/messages", json={"body": "x" * 5001}
    )
    assert response.status_code == 422


# --- sending, reading, unread counts -------------------------------------------------------------


def test_sending_and_reading_a_message_round_trip(admin_db: LocalDatabase) -> None:
    """A message sent by the client appears to the vendor, with the client as sender."""
    client_account = seed_account(admin_db, unique_email("chat-roundtrip-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-roundtrip-vendor")
    client_browser = sign_in(client_account)
    vendor_browser = sign_in(vendor_account)
    conversation = _create_dm(client_browser, vendor_account.user_id)
    body_text = f"Hello vendor {uuid.uuid4().hex[:8]}"

    send_response = client_browser.post(
        f"{API}/chat/conversations/{conversation['id']}/messages", json={"body": body_text}
    )
    assert send_response.status_code == 200
    sent_message = send_response.json()["message"]
    assert sent_message["sender_user_id"] == client_account.user_id
    assert sent_message["body"] == body_text
    assert sent_message["metadata"] is None

    vendor_messages = vendor_browser.get(f"{API}/chat/conversations/{conversation['id']}/messages")
    assert vendor_messages.status_code == 200
    bodies = [row["body"] for row in vendor_messages.json()["messages"]]
    assert body_text in bodies


def test_unread_count_rises_on_receipt_and_clears_on_read(admin_db: LocalDatabase) -> None:
    """The recipient's unread count reflects the peer's unsent-read messages, then clears."""
    client_account = seed_account(admin_db, unique_email("chat-unread-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-unread-vendor")
    client_browser = sign_in(client_account)
    vendor_browser = sign_in(vendor_account)
    conversation = _create_dm(client_browser, vendor_account.user_id)

    baseline_unread = vendor_browser.get(f"{API}/chat/unread-count").json()["unread_count"]

    client_browser.post(
        f"{API}/chat/conversations/{conversation['id']}/messages",
        json={"body": f"unread me {uuid.uuid4().hex[:8]}"},
    )

    after_send = vendor_browser.get(f"{API}/chat/unread-count").json()["unread_count"]
    assert after_send == baseline_unread + 1

    detail = vendor_browser.get(f"{API}/chat/conversations/{conversation['id']}").json()["conversation"]
    assert detail["unread_count"] == 1

    mark_read_response = vendor_browser.post(f"{API}/chat/conversations/{conversation['id']}/read")
    assert mark_read_response.status_code == 200
    assert mark_read_response.json() == {"success": True}

    after_read = vendor_browser.get(f"{API}/chat/unread-count").json()["unread_count"]
    assert after_read == baseline_unread

    detail_after_read = vendor_browser.get(f"{API}/chat/conversations/{conversation['id']}").json()[
        "conversation"
    ]
    assert detail_after_read["unread_count"] == 0


def test_sending_a_message_does_not_mark_it_unread_for_the_sender(admin_db: LocalDatabase) -> None:
    """The sender's own unread count is unaffected by the message they just sent."""
    client_account = seed_account(admin_db, unique_email("chat-selfread-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-selfread-vendor")
    client_browser = sign_in(client_account)
    conversation = _create_dm(client_browser, vendor_account.user_id)

    before = client_browser.get(f"{API}/chat/unread-count").json()["unread_count"]
    client_browser.post(
        f"{API}/chat/conversations/{conversation['id']}/messages",
        json={"body": f"no self-unread {uuid.uuid4().hex[:8]}"},
    )
    after = client_browser.get(f"{API}/chat/unread-count").json()["unread_count"]
    assert after == before


def test_conversations_list_includes_a_newly_opened_dm(admin_db: LocalDatabase) -> None:
    """A freshly opened DM appears in the client's conversation list."""
    client_account = seed_account(admin_db, unique_email("chat-list-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "chat-list-vendor")
    browser = sign_in(client_account)
    conversation = _create_dm(browser, vendor_account.user_id)

    listing = browser.get(f"{API}/chat/conversations")
    assert listing.status_code == 200
    ids = {row["id"] for row in listing.json()["conversations"]}
    assert conversation["id"] in ids
