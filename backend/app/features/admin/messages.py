"""User-facing admin copy for API responses and HTTP errors."""

from __future__ import annotations

from app.features.bookings import messages as booking_messages

# --- Permissions / role guards ---

SUPER_ADMIN_ONLY = "Only super admins can perform this action."
LISTING_OVERRIDE_SUPER_ADMIN_ONLY = (
    "Only super admins can force a vendor listing visible or hidden."
)
BROADCAST_SUPPORT_SUPER_ADMIN_ONLY = (
    "Only super admins can broadcast support messages to all clients, vendors, or users."
)
DISPUTE_FINANCIAL_RESOLUTION_SUPER_ADMIN_ONLY = (
    "Only super admins can resolve disputes with a financial outcome."
)
DISPUTE_REFUND_AMOUNT_SUPER_ADMIN_ONLY = (
    "Only super admins can set refund amounts on disputes."
)

# --- Generic HTTP ---

NO_FIELDS_TO_UPDATE = "No fields to update"
INVALID_DATE = "Invalid date. Use YYYY-MM-DD."

# --- Bookings (shared with bookings feature) ---

INVALID_BOOKING_ID = booking_messages.INVALID_BOOKING_ID
BOOKING_NOT_FOUND_DOT = booking_messages.BOOKING_NOT_FOUND
BOOKING_NOT_FOUND = "Booking not found"
COULD_NOT_UPDATE_PAYMENT_FIELDS = "Could not update payment fields"

# --- Booking recovery ---

ONLY_UNPAID_PENDING_RESET = "Only unpaid or pending checkout bookings can be reset."
PAYMENT_INTENT_NOT_SUCCEEDED = "Payment intent is not in a succeeded state."
PAYMENT_INTENT_BOOKING_MISMATCH = "Payment intent does not match this booking."
PAYMENT_INTENT_NO_CONFIRMED_AMOUNT = "Payment intent has no confirmed amount."
ONLY_ACCEPTED_MARK_PAID = "Only accepted bookings can be marked paid."
CHECKOUT_SESSION_NOT_FOUND = (
    "Checkout session not found in Stripe. Checkout was reset - verify charge manually."
)
NO_CHECKOUT_OR_PI_TO_SYNC = "No checkout session or payment intent on file to sync."
BOOKING_MARK_PAID_FAILED = (
    "Booking could not be marked paid - check status and payment state."
)
ONLY_PAID_PAYOUT_RELEASE = "Only paid bookings can have payout released."
BOOKING_MUST_BE_ACCEPTED_PAYOUT = "Booking must be accepted to release payout."
OPEN_DISPUTE_BLOCKS_PAYOUT = "Open dispute blocks payout release."
PAYOUT_RELEASE_ELIGIBILITY = (
    "Payout can only be released when both parties confirmed or auto-release is due."
)
PAYOUT_NOT_RELEASED = (
    "Payout was not released - vendor Stripe account may not be ready or transfer failed."
)
ONLY_REFUNDED_COMPLETE_CANCEL = "Only refunded bookings can be completed as cancelled."
NOT_ACCEPTED_REFUNDED_STATE = "Booking is not in accepted + refunded state."
COULD_NOT_COMPLETE_CANCELLATION = "Could not complete cancellation."
INTERNAL_REASON_REQUIRED = "Internal reason is required."
ONLY_PENDING_ACCEPTED_CANCEL = "Only pending or accepted bookings can be cancelled."
COULD_NOT_CANCEL_BOOKING = "Could not cancel booking."
ONLY_ACCEPTED_MARK_COMPLETE = "Only accepted bookings can be marked complete."
PAYMENT_REQUIRED_MARK_COMPLETE = "Payment must be completed before marking complete."

# --- Booking payment patch ---

STRIPE_PI_REQUIRED_FOR_AMOUNT = (
    "stripe_payment_intent_id is required to set payment_amount_gbp."
)
STRIPE_VERIFY_FAILED = "Could not verify payment with Stripe. Try again later."
STRIPE_PI_NO_CONFIRMED_AMOUNT = "Stripe payment intent has no confirmed amount."
STRIPE_CHARGE_UNVERIFIED = (
    "Could not verify stripe_charge_id - payment intent has no charge yet."
)
STRIPE_CHARGE_MISMATCH = "stripe_charge_id does not match the payment intent."

# --- Disputes ---

DISPUTE_STATUS_INVALID = "status must be all, open, under_review, resolved, or closed"
DISPUTE_NOT_FOUND = "Dispute not found"
DISPUTE_NOT_FOUND_DOT = "Dispute not found."
REFUND_AMOUNT_REQUIRED_PARTIAL = "refund_amount_gbp is required for a partial refund."
ONLY_PAID_PARTIAL_REFUND = "Only paid bookings can be partially refunded."
NO_RECORDED_PAYMENT_AMOUNT = "No recorded payment amount for this booking."

# --- Team ---

ASSIGNEE_MUST_BE_ADMIN = "Assignee must be an admin account."
ASSIGNEE_ADMIN_SUSPENDED = "Assignee admin account is suspended."
COULD_NOT_SET_PASSWORD = "Could not set password for this account."
INVALID_EMAIL_ADDRESS = "Enter a valid email address."
COULD_NOT_CREATE_ADMIN = "Could not create admin account."
ONLY_SUPER_ADMIN_RESET_LINK = "Only super admins can send password reset links."
ADMIN_USER_NOT_FOUND = "Admin user not found."
ADMIN_USER_NO_EMAIL = "Admin user has no email on file."
COULD_NOT_DELETE_ADMIN = "Could not delete this admin account."
ONLY_SUPER_ADMIN_DELETE_TEAM = "Only super admins can delete team members."
CANNOT_DELETE_SELF = "You cannot delete yourself."
CANNOT_DELETE_LAST_SUPER_ADMIN = "Cannot delete the last super admin."
ONLY_SUPER_ADMIN_CHANGE_TEAM = "Only super admins can change team members."
CANNOT_DEMOTE_SELF = "You cannot demote yourself."
CANNOT_SUSPEND_SELF = "You cannot suspend yourself."
CANNOT_DEMOTE_LAST_SUPER_ADMIN = "Cannot demote the last super admin."
ADMIN_NOT_FOUND = "Admin not found"
PASSWORD_SETUP_LINK_SENT = "Password setup link sent to this admin."
ADMIN_ALREADY_PASSWORD_UPDATED = "This person is already an admin. Password updated."
PROMOTED_ADMIN_PASSWORD_LINK = (
    "Existing account promoted to admin. We sent a link to set their password."
)
PROMOTED_TO_ADMIN = "Existing account promoted to admin."
ADMIN_CREATED_PASSWORD_LINK = (
    "Admin account created. We sent a link to set their password."
)
ADMIN_CREATED = "Admin account created."
PASSWORD_RESET_LINK_SENT = "Password reset link sent."
ADMIN_REMOVED_REMAINS_VENDOR = "Admin access removed. This account remains a vendor."
ADMIN_REMOVED_REMAINS_CLIENT = "Admin access removed. This account remains a client."
ADMIN_ACCOUNT_DELETED = "Admin account deleted."

# --- Email test ---

UNKNOWN_EMAIL_TEMPLATE = "Unknown email template."
EMAIL_NOT_SENT_CHECK_LOGS = "Email was not sent. Check RESEND_API_KEY and logs."
EMAIL_NOT_SENT_CHECK_SERVER_LOGS = (
    "Email was not sent. Check RESEND_API_KEY and server logs."
)

# --- Support messaging ---

RECIPIENTS_OR_AUDIENCE_REQUIRED = (
    "Provide recipient_user_ids and/or audience (clients|vendors|users)."
)
SUPPORT_CONVERSATION_NOT_FOUND = "Support conversation not found."
COULD_NOT_SEND_MESSAGE = "Could not send message."
COULD_NOT_UPDATE_MESSAGE = "Could not update message."
COULD_NOT_UPDATE_READ_STATE = "Could not update read state."

# --- Directory / clients ---

SUSPENSION_UPDATE_FAILED = "Could not update suspension (migration or user missing)."

# --- Vendors ---

VENDOR_PROFILE_NOT_FOUND = "Vendor profile not found"
COULD_NOT_RESTORE_STRIPE_CONNECT = "Could not restore Stripe Connect."

# --- Reviews ---

REVIEW_NOT_FOUND = "Review not found"
COULD_NOT_UPDATE_REVIEW_VISIBILITY = "Could not update review visibility"

# --- Audit ---

AUDIT_ENTRY_NOT_FOUND = "Audit entry not found"


def partial_refund_range_detail(paid_amt: float) -> str:
    return f"Partial refund must be between 0 and GBP {paid_amt:.2f}."


def email_sent_to_detail(email: str) -> str:
    return f"Sent to {email}."
