"""User-facing booking copy for API responses and HTTP errors."""

from __future__ import annotations

# --- Identifiers / lookups ---

INVALID_BOOKING_ID = "Invalid booking id."
BOOKING_NOT_FOUND = "Booking not found."
INVALID_VENDOR_ID = "Invalid vendor id."
INVALID_CLIENT_ID = "Invalid client id."
INVALID_CONVERSATION_ID = "Invalid conversation id."
INVALID_DISPUTE_ID = "Invalid dispute id."
DISPUTE_NOT_FOUND = "Dispute not found."
INVALID_BOOKING = "Invalid booking."

# --- List filters ---

GROUP_QUERY_PARAM = "Query parameter group must be active, completed, closed, or all."
GROUP_INTERNAL = "group must be active, completed, closed, or all"

# --- Payments / checkout ---

ONLY_ACCEPTED_CAN_BE_PAID = "Only accepted bookings can be paid."
BOOKING_ALREADY_PAID = "This booking has already been paid."
VENDOR_PAYOUTS_NOT_READY = (
    "This vendor hasn't finished setting up payouts yet. Try again once they have."
)
VENDOR_NOT_AVAILABLE_SHORT = "This vendor is not available for booking right now."
NOTHING_TO_PAY = "Nothing to pay for this booking."
ADD_EVENT_ADDRESS_BEFORE_PAY = (
    "Add your event address on the booking before paying. Your vendor needs it to prepare."
)
BOOKING_NO_LONGER_PAID = "This booking can no longer be paid."
NO_CHECKOUT_SESSION = "No checkout session found for this booking."
PAYMENT_LINK_EXPIRED = (
    "That payment link has expired. Tap Pay now to start a fresh checkout."
)
CHECKOUT_SESSION_MISMATCH = "This checkout session does not match this booking."
CHECKOUT_SESSION_ACCOUNT_MISMATCH = "This checkout session does not match your account."
PAYMENT_NOT_FINISHED = (
    "Payment has not finished processing yet. Wait a moment and refresh."
)
ONLY_PAID_CAN_REFUND = "Only paid bookings can be refunded."
NO_PAYMENT_ON_RECORD = "No payment on record for this booking."
REFUND_FAILED = "We couldn't process the refund right now. Please try again shortly."
PAYOUT_AMOUNT_MISSING = "Payout amount is missing for this booking. Please contact support."
PAYOUT_RELEASE_FAILED = (
    "We couldn't release the payout right now. Please try again shortly."
)
ONLY_ACCEPTED_CAN_COMPLETE = "Only accepted bookings can be marked complete."
PAYMENT_REQUIRED_FOR_COMPLETE = (
    "Payment must be completed before this booking can be marked complete."
)
ONLY_PAID_PAYOUT_RELEASE = "Only paid bookings can have their payout released."
COULD_NOT_START_CHECKOUT = "Could not start checkout. Try again shortly."
COULD_NOT_CONFIRM_PAYMENT = "Could not confirm payment. Try refreshing in a moment."

# --- Status transitions / cancel ---

CANCEL_COMPLETE_INSTEAD = (
    "This booking is already complete, so it can't be cancelled. "
    "If something went wrong, report a problem instead."
)
CANCEL_AFTER_PAYOUT = (
    "The vendor has already been paid for this booking, so it can't be "
    "cancelled. If something went wrong, report a problem instead."
)
CANCEL_PARTIAL_REFUND = (
    "This booking has a partial refund on record, so it can't be cancelled. "
    "Contact support if you need help."
)
BOOKING_ALREADY_REFUNDED = "This booking has already been refunded."
CANCEL_OPEN_DISPUTE = (
    "This booking has an open problem report. It can't be cancelled until "
    "that's resolved."
)
STATUS_VENDOR_MUST_BE = "Status must be accepted, declined, or cancelled."
CANCEL_ONLY_ACCEPTED_OR_QUOTE = (
    "Cancel is only for accepted bookings or withdrawing a pending vendor quote."
)
CLIENT_MUST_ACCEPT_QUOTE = "The client must accept a vendor quote."
COMPLETE_PAYOUT_SETUP = "Complete payout setup before accepting bookings."
CLIENT_MUST_CONFIRM_PRICE = (
    "The client must confirm the updated price before you can accept this booking."
)
ACCEPT_ONLY_PENDING_OR_REJECTED = (
    "Accept is only available for pending requests or previously rejected requests."
)
WITHDRAW_QUOTE_USE_CANCEL = "Withdraw a quote you sent using cancel instead of reject."
ONLY_PENDING_CAN_DECLINE = "Only pending requests can be declined."
UNSUPPORTED_STATUS_TRANSITION = "Unsupported status transition."
ONLY_PENDING_OR_ACCEPTED_CANCEL = "Only pending or accepted bookings can be cancelled."
STATUS_CLIENT_MUST_BE = "Status must be accepted or declined."
ONLY_PENDING_ACCEPT_DECLINE = "Only pending bookings can be accepted or declined."
VENDOR_QUOTE_OR_UPDATED_PRICE = (
    "This action applies to vendor quotes or when the vendor sent an updated price."
)

# --- Create / quotes ---

CANNOT_BOOK_OWN_VENDOR = "Cannot book your own account as vendor."
VENDOR_NOT_AVAILABLE_FULL = (
    "This vendor is not available for booking right now. "
    "They may be unlisted, not yet approved, or still setting up payouts."
)
BOOKING_NO_VALID_PRICE = "This booking has no valid price."
CANNOT_QUOTE_SELF = "Cannot send a quote to yourself."
VENDOR_PROFILE_NOT_AVAILABLE = (
    "Your vendor profile is not available for bookings right now. "
    "Finish payout setup to appear to clients and send quotes."
)
ADD_PRICED_LINE_ITEM = "Add at least one priced line item."
QUOTE_LINE_NEEDS_PRICE = "Each quote line needs a price."
QUOTE_TOTAL_GT_ZERO = "Quote total must be greater than zero."

# --- Calendar / availability ---

VENDOR_NOT_AVAILABLE_CALENDAR = (
    "This vendor is not available for booking right now. "
    "They may be unlisted or not yet approved."
)
COULD_NOT_VERIFY_AVAILABILITY = (
    "Could not verify vendor availability for that date. Please try again."
)
MAX_BOOKINGS_ON_DATE = (
    "This vendor already has the maximum number of bookings ({cap}) "
    "on {day_iso}. Choose another date or contact the vendor."
)
MAX_BOOKINGS_ON_DATE_FALLBACK = (
    "This vendor already has the maximum number of bookings on that date. "
    "Choose another date or contact the vendor."
)


def max_bookings_on_date_detail(*, cap: int, day_iso: str) -> str:
    return MAX_BOOKINGS_ON_DATE.format(cap=cap, day_iso=day_iso)


# --- Line items / quote validation ---

QUOTE_MAX_LINES = "A quote cannot have more than {max_lines} line items."
INVALID_LINE_ITEM = "Invalid line item."
LINE_ITEM_NEEDS_HEADING = "Each line item needs a heading."
QUOTE_LINE_VALID_PRICE = "Each quote line needs a valid price."
QUOTE_LINE_MIN_PRICE = "Each quote line must be at least GBP {min_price:.2f}."
QUOTE_LINE_PRICE_TOO_HIGH = "A quote line price is too high."


def quote_max_lines_detail(max_lines: int) -> str:
    return QUOTE_MAX_LINES.format(max_lines=max_lines)


def quote_line_min_price_detail(min_price: float) -> str:
    return QUOTE_LINE_MIN_PRICE.format(min_price=min_price)


# --- Adjustments ---

ADJUSTMENTS_NOT_ON_VENDOR_QUOTE = (
    "Adjustments are not editable on vendor quotes before the client accepts."
)
ADDITIONAL_COSTS_PENDING_ONLY = (
    "Additional costs can only be edited while the request is pending."
)
ADJUSTMENT_VALID_AMOUNT = "Each adjustment needs a valid amount_gbp."
ADJUSTMENT_OUT_OF_RANGE = "Adjustment amount is out of range."
DISCOUNTS_TOO_HIGH = "Discounts cannot reduce the booking total to zero or below."
SURCHARGE_MAX = "Each surcharge cannot exceed GBP {max_single:,.0f}."
SURCHARGES_PCT = "Total surcharges cannot exceed {max_pct:.0f}% of the quoted line items."


def surcharge_max_detail(max_single: float) -> str:
    return SURCHARGE_MAX.format(max_single=max_single)


def surcharges_pct_detail(max_pct: float) -> str:
    return SURCHARGES_PCT.format(max_pct=max_pct)


# --- Venue ---

VENUE_ACCEPTED_ONLY = "Venue can only be updated on accepted bookings."
ENTER_VENUE_ADDRESS = "Enter the venue address."

# --- Client guard checks ---

COULD_NOT_VERIFY_CLIENT = "Could not verify client account."
CLIENT_NOT_FOUND = "Client not found."
QUOTES_CLIENT_ONLY = "Quotes can only be sent to a client account."
CLIENT_SUSPENDED = "This client account is suspended."

# --- Pricing refresh ---

BOOKING_MISSING_EVENT_DATE = "Booking is missing a valid event date."
PRICES_TO_CONFIRM = "This booking still has prices to be confirmed before you can pay."

# --- Reviews ---

REVIEW_AFTER_COMPLETE = "You can only review a booking after it is marked complete."
REVIEW_ALREADY_SUBMITTED = "You have already submitted a review for this booking."
REVIEW_MIN_LENGTH = "Review must be at least 10 characters."
REVIEW_TOO_LONG = "Review is too long."
REVIEW_MAX_PHOTOS = "You can attach up to {max_photos} photos."
COULD_NOT_SAVE_REVIEW = "Could not save review."


def review_max_photos_detail(max_photos: int) -> str:
    return REVIEW_MAX_PHOTOS.format(max_photos=max_photos)


# --- Disputes ---

CANNOT_OPEN_DISPUTE = "You cannot open a dispute for this booking."
DISPUTE_ALREADY_OPEN = "A dispute is already open or under review for this booking."
DISPUTE_INVALID_STATUS = (
    "Disputes cannot be opened for this booking in its current status."
)
COULD_NOT_CREATE_DISPUTE = "Could not create dispute."

# --- HTTP save failures ---

COULD_NOT_SAVE_BOOKING_REQUEST = "Could not save your booking request. Try again later."
COULD_NOT_SAVE_QUOTE = "Could not save your quote. Try again later."
