"""Errors the messaging slice raises. Messages are the baseline's user-facing copy, verbatim.

The baseline answered most chat failures with a bare 400 carrying one of these
messages; the statuses are kept so the web keeps working, and each now has a code.
"""

from __future__ import annotations

from app.core.errors import Forbidden, InvalidInput, NotFound

# The longest message a person can type, in visible characters.
MAX_MESSAGE_LENGTH = 5000


class ChatPortalOnly(Forbidden):
    """Staff accounts have their own support inbox; `/chat` lists are for clients and vendors."""

    code = "chat_portal_only"
    default_message = "Chat is only available for client and vendor accounts."


class ClientBookingsOnly(Forbidden):
    """A vendor may start a chat only with a client who has booked (or enquired with) them."""

    code = "chat_client_bookings_only"
    default_message = "You can only message clients you have bookings with."


class ConversationNotFound(NotFound):
    """No conversation with that id that the caller takes part in."""

    code = "conversation_not_found"
    default_message = "Conversation not found."


class ConversationNotFoundOnSend(InvalidInput):
    """Sending to a conversation that does not exist (the baseline answered 400 here, not 404)."""

    code = "conversation_not_found_on_send"
    default_message = "Conversation not found."


class NotInConversation(InvalidInput):
    """Sending to a conversation the caller is not part of (400, as the baseline did)."""

    code = "not_in_conversation"
    default_message = "You are not part of this conversation."


class NotInConversationOnRead(Forbidden):
    """Marking read a conversation the caller is not part of (403, as the baseline did)."""

    code = "not_in_conversation_on_read"
    default_message = "You are not part of this conversation."


class MessageEmpty(InvalidInput):
    """The message has no visible text."""

    code = "message_empty"
    default_message = "Message cannot be empty."


class MessageTooLong(InvalidInput):
    """The message has more visible characters than a person may send."""

    code = "message_too_long"
    default_message = f"Message is too long (max {MAX_MESSAGE_LENGTH} characters)."


class SelfChat(InvalidInput):
    """Opening a chat with yourself."""

    code = "chat_with_self"
    default_message = "You can't start a chat with yourself."


class VendorNotFound(InvalidInput):
    """The peer id names no account."""

    code = "chat_vendor_not_found"
    default_message = "Vendor not found."


class NotVendorAccount(InvalidInput):
    """The peer account exists but is not a vendor."""

    code = "chat_not_vendor_account"
    default_message = "That user is not a vendor account."


class VendorUnavailable(InvalidInput):
    """The vendor is not publicly listed, so clients cannot message them."""

    code = "chat_vendor_unavailable"
    default_message = "This vendor is not available for messages."


class SupportConversationNotFound(NotFound):
    """No support thread with that id."""

    code = "support_conversation_not_found"
    default_message = "Support conversation not found."


class MessageNotFound(NotFound):
    """No message with that id in the support thread."""

    code = "message_not_found"
    default_message = "Message not found."


class StaffMessagesOnly(Forbidden):
    """Staff tried to edit the end user's own message."""

    code = "staff_messages_only"
    default_message = "Only staff messages can be edited."


class EditOwnMessagesOnly(Forbidden):
    """Staff tried to edit a message another staff member sent."""

    code = "edit_own_messages_only"
    default_message = "You can only edit messages you sent."


class RecipientsRequired(InvalidInput):
    """A staff send named no recipients and no audience (or the audience is empty)."""

    code = "recipients_or_audience_required"
    default_message = "Provide recipient_user_ids and/or audience (clients|vendors|users)."


class BroadcastSuperAdminOnly(Forbidden):
    """Only super admins may send to a whole audience."""

    code = "broadcast_super_admin_only"
    default_message = "Only super admins can broadcast support messages to all clients, vendors, or users."


class QuoteConversationNotFound(InvalidInput):
    """A vendor quote names a conversation that does not exist (400, as the baseline did)."""

    code = "quote_conversation_not_found"
    default_message = "Conversation not found."


class BookingConversationMismatch(InvalidInput):
    """A vendor quote names a thread that is not the DM between this vendor and client."""

    code = "booking_conversation_mismatch"
    default_message = "That conversation doesn't match this booking. Open Messages and try again."
