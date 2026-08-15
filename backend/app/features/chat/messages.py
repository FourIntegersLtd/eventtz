"""User-facing chat and support messaging copy."""

from __future__ import annotations

CHAT_PORTAL_ONLY = "Chat is only available for client and vendor accounts."
CLIENT_BOOKINGS_ONLY = "You can only message clients you have bookings with."
CONVERSATION_NOT_FOUND = "Conversation not found."
SUPPORT_CONVERSATION_NOT_FOUND = "Support conversation not found."
MESSAGE_NOT_FOUND = "Message not found."
MESSAGE_EMPTY = "Message cannot be empty."
MESSAGE_TOO_LONG = "Message is too long (max {max_len} characters)."
RECIPIENTS_REQUIRED = "At least one recipient is required."
SUPPORT_START_FAILED = "We couldn't start that conversation. Please try again."
STAFF_MESSAGES_ONLY = "Only staff messages can be edited."
EDIT_OWN_MESSAGES_ONLY = "You can only edit messages you sent."
VENDOR_VERIFY_FAILED = "Could not verify vendor."
VENDOR_NOT_FOUND = "Vendor not found."
NOT_VENDOR_ACCOUNT = "That user is not a vendor account."
SELF_CHAT_FORBIDDEN = "You can't start a chat with yourself."
VENDOR_UNAVAILABLE = "This vendor is not available for messages."
NOT_IN_CONVERSATION = "You are not part of this conversation."
CONVERSATION_VERIFY_FAILED = "Could not verify conversation."
BOOKING_CONVERSATION_MISMATCH = (
    "That conversation doesn't match this booking. Open Messages and try again."
)
CONVERSATION_LOAD_FAILED = "Could not load conversation."
CONVERSATION_START_FAILED = "Could not start conversation."
SEND_MESSAGE_FAILED = "Could not send message."
READ_STATE_UPDATE_FAILED = "Could not update read state."
SUPPORT_CONVERSATION_LOAD_FAILED = "Could not load support conversation."
SUPPORT_CONVERSATION_START_FAILED = "Could not start support conversation."
SEND_FAILED = "Failed to send."
MESSAGE_LOAD_FAILED = "Could not load message."
MESSAGE_UPDATE_FAILED = "Could not update message."

CLIENT_DISPLAY_FALLBACK = "Client"
VENDOR_DISPLAY_FALLBACK = "Vendor"
VENDOR_LOCAL_DISPLAY = "Vendor (local)"
PEER_UNKNOWN = "Unknown"
USER_DISPLAY_FALLBACK = "User"
SUPPORT_PEER_DISPLAY = "Eventtz Support"
ADMIN_SENDER_DISPLAY = "Eventtz Admin"

QUOTE_SENT_BODY = "Sent a custom quote - {event_name} ({total_label})"


def message_too_long_detail(max_len: int) -> str:
    return MESSAGE_TOO_LONG.format(max_len=max_len)


def quote_sent_body(event_name: str, total_label: str) -> str:
    return QUOTE_SENT_BODY.format(event_name=event_name, total_label=total_label)
