"""Errors the bookings slice raises. Messages are the baseline's user-facing copy, verbatim.

The baseline answered almost every booking rule with a 400 carrying one of these
messages (and a 404 for a booking the caller cannot see); the statuses are kept so
the web keeps working, and each now has a stable code.
"""

from __future__ import annotations

from app.core.errors import InvalidInput, NotFound, Unavailable

# --- ids and lookups -------------------------------------------------------------------------------


class BookingNotFound(NotFound):
    """No booking with that id that the caller is a party to (someone else's looks missing too)."""

    code = "booking_not_found"
    default_message = "Booking not found."


class InvalidBookingId(InvalidInput):
    """The booking id in the path is not a UUID."""

    code = "invalid_booking_id"
    default_message = "Invalid booking id."


class InvalidVendorId(InvalidInput):
    """The vendor id in a booking request is not a UUID."""

    code = "booking_invalid_vendor_id"
    default_message = "Invalid vendor id."


class InvalidClientId(InvalidInput):
    """The client id in a vendor quote is not a UUID."""

    code = "booking_invalid_client_id"
    default_message = "Invalid client id."


class InvalidConversationId(InvalidInput):
    """The conversation id in a vendor quote is not a UUID."""

    code = "booking_invalid_conversation_id"
    default_message = "Invalid conversation id."


class InvalidListGroup(InvalidInput):
    """The `group` query parameter is not one of the list's groups."""

    code = "booking_invalid_group"
    default_message = "Query parameter group must be active, completed, closed, or all."


# --- creating a request or a quote -------------------------------------------------------------------


class CannotBookOwnVendor(InvalidInput):
    """A client tried to book their own account as the vendor."""

    code = "cannot_book_own_vendor"
    default_message = "Cannot book your own account as vendor."


class VendorNotBookable(InvalidInput):
    """The vendor is unlisted, unapproved, or still setting up payouts."""

    code = "vendor_not_bookable"
    default_message = (
        "This vendor is not available for booking right now. They may be unlisted, not yet approved, "
        "or still setting up payouts."
    )


class EventDatesUnavailable(InvalidInput):
    """A day of the event is blocked, or falls on a weekday the vendor does not work."""

    code = "event_dates_unavailable"
    default_message = (
        "The event date(s) fall on days this vendor has marked unavailable. "
        "Choose different dates or contact the vendor via Messages."
    )


class EventSpanTooLong(InvalidInput):
    """The event runs over more days than a booking may cover."""

    code = "event_span_too_long"
    default_message = "Event cannot span more than 366 days."


class VendorFullOnDate(InvalidInput):
    """The vendor already has their maximum open bookings on a day of the event."""

    code = "vendor_full_on_date"
    default_message = (
        "This vendor already has the maximum number of bookings on that date. "
        "Choose another date or contact the vendor."
    )


class LineItemsInvalid(InvalidInput):
    """The chosen packages do not match the vendor's price list (the message says which rule broke)."""

    code = "booking_line_items_invalid"
    default_message = "Invalid line item."


class NoValidPrice(InvalidInput):
    """The chosen packages add up to nothing payable."""

    code = "booking_no_valid_price"
    default_message = "This booking has no valid price."


class PartySuspended(InvalidInput):
    """The other party's account is suspended."""

    code = "booking_party_suspended"
    default_message = "This account is suspended."


class CannotQuoteSelf(InvalidInput):
    """A vendor tried to send a quote to their own account."""

    code = "cannot_quote_self"
    default_message = "Cannot send a quote to yourself."


class VendorProfileNotBookable(InvalidInput):
    """The quoting vendor's own profile cannot take bookings yet."""

    code = "vendor_profile_not_bookable"
    default_message = (
        "Your vendor profile is not available for bookings right now. Finish payout setup to appear "
        "to clients and send quotes."
    )


class QuoteClientNotFound(InvalidInput):
    """The quote names no account."""

    code = "quote_client_not_found"
    default_message = "Client not found."


class QuotesClientOnly(InvalidInput):
    """The quote names an account that is not a client."""

    code = "quotes_client_only"
    default_message = "Quotes can only be sent to a client account."


class QuoteClientSuspended(InvalidInput):
    """The quote names a suspended client."""

    code = "quote_client_suspended"
    default_message = "This client account is suspended."


class QuoteNeedsLineItem(InvalidInput):
    """The quote has no line items."""

    code = "quote_needs_line_item"
    default_message = "Add at least one priced line item."


class QuoteLineNeedsPrice(InvalidInput):
    """A quote line has no price."""

    code = "quote_line_needs_price"
    default_message = "Each quote line needs a price."


class QuoteTotalNotPositive(InvalidInput):
    """The quote adds up to zero or less."""

    code = "quote_total_not_positive"
    default_message = "Quote total must be greater than zero."


class QuoteLineInvalid(InvalidInput):
    """A quote line breaks a shape or price rule (the message says which)."""

    code = "quote_line_invalid"
    default_message = "Invalid line item."


# --- vendor status changes ---------------------------------------------------------------------------


class CancelOnlyAcceptedOrQuote(InvalidInput):
    """A vendor may cancel only an accepted booking, or withdraw their own pending quote."""

    code = "cancel_only_accepted_or_quote"
    default_message = "Cancel is only for accepted bookings or withdrawing a pending vendor quote."


class ClientMustAcceptQuote(InvalidInput):
    """A vendor tried to accept their own quote."""

    code = "client_must_accept_quote"
    default_message = "The client must accept a vendor quote."


class PayoutSetupRequired(InvalidInput):
    """The vendor cannot accept until Stripe can pay them (or staff waive the requirement)."""

    code = "payout_setup_required"
    default_message = "Complete payout setup before accepting bookings."


class ClientMustConfirmPrice(InvalidInput):
    """The vendor changed the price; the client has to confirm it before the vendor accepts."""

    code = "client_must_confirm_price"
    default_message = "The client must confirm the updated price before you can accept this booking."


class AcceptOnlyPendingOrDeclined(InvalidInput):
    """Accept is for pending requests, or re-accepting one the vendor declined."""

    code = "accept_only_pending_or_declined"
    default_message = "Accept is only available for pending requests or previously rejected requests."


class WithdrawQuoteWithCancel(InvalidInput):
    """A vendor tried to decline their own quote."""

    code = "withdraw_quote_with_cancel"
    default_message = "Withdraw a quote you sent using cancel instead of reject."


class DeclineOnlyPending(InvalidInput):
    """Only a pending request can be declined."""

    code = "decline_only_pending"
    default_message = "Only pending requests can be declined."


# --- client status changes ---------------------------------------------------------------------------


class CancelOnlyPendingOrAccepted(InvalidInput):
    """A client may cancel only a pending or accepted booking."""

    code = "cancel_only_pending_or_accepted"
    default_message = "Only pending or accepted bookings can be cancelled."


class RespondOnlyPending(InvalidInput):
    """A client may accept or decline only a pending booking."""

    code = "respond_only_pending"
    default_message = "Only pending bookings can be accepted or declined."


class NothingToRespondTo(InvalidInput):
    """Accept/decline is for a vendor quote or a vendor's updated price, and this is neither."""

    code = "nothing_to_respond_to"
    default_message = "This action applies to vendor quotes or when the vendor sent an updated price."


# --- cancel guard ------------------------------------------------------------------------------------


class CancelCompleteInstead(InvalidInput):
    """A completed booking cannot be cancelled."""

    code = "cancel_complete_instead"
    default_message = (
        "This booking is already complete, so it can't be cancelled. If something went wrong, "
        "report a problem instead."
    )


class CancelAfterPayout(InvalidInput):
    """The vendor has been paid, so the booking cannot be cancelled."""

    code = "cancel_after_payout"
    default_message = (
        "The vendor has already been paid for this booking, so it can't be cancelled. If something "
        "went wrong, report a problem instead."
    )


class CancelPartialRefund(InvalidInput):
    """A partly refunded booking cannot be cancelled."""

    code = "cancel_partial_refund"
    default_message = (
        "This booking has a partial refund on record, so it can't be cancelled. Contact support if "
        "you need help."
    )


class BookingAlreadyRefunded(InvalidInput):
    """The booking was refunded already."""

    code = "booking_already_refunded"
    default_message = "This booking has already been refunded."


class CancelOpenDispute(InvalidInput):
    """A booking with an open problem report cannot be cancelled."""

    code = "cancel_open_dispute"
    default_message = "This booking has an open problem report. It can't be cancelled until that's resolved."


# --- adjustments -------------------------------------------------------------------------------------


class AdjustmentsNotOnVendorQuote(InvalidInput):
    """A vendor quote's price is fixed until the client accepts."""

    code = "adjustments_not_on_vendor_quote"
    default_message = "Adjustments are not editable on vendor quotes before the client accepts."


class AdjustmentsPendingOnly(InvalidInput):
    """Extras and discounts change only while the request is pending."""

    code = "adjustments_pending_only"
    default_message = "Additional costs can only be edited while the request is pending."


class AdjustmentAmountInvalid(InvalidInput):
    """An adjustment amount is missing or not a number."""

    code = "adjustment_amount_invalid"
    default_message = "Each adjustment needs a valid amount_gbp."


class AdjustmentOutOfRange(InvalidInput):
    """An adjustment amount is past ±£1,000,000."""

    code = "adjustment_out_of_range"
    default_message = "Adjustment amount is out of range."


class DiscountsTooHigh(InvalidInput):
    """Discounts would bring the vendor's price to zero or below."""

    code = "discounts_too_high"
    default_message = "Discounts cannot reduce the booking total to zero or below."


class SurchargeTooHigh(InvalidInput):
    """One surcharge, or all of them together, is over the cap (the message gives it)."""

    code = "surcharge_too_high"
    default_message = "Surcharges are over the allowed limit."


# --- venue and completion ----------------------------------------------------------------------------


class VenueAcceptedOnly(InvalidInput):
    """The venue can be set only once the booking is accepted."""

    code = "venue_accepted_only"
    default_message = "Venue can only be updated on accepted bookings."


class BookingAlreadyPaid(InvalidInput):
    """The venue is fixed once the booking is paid."""

    code = "booking_already_paid"
    default_message = "This booking has already been paid."


class CompleteOnlyAccepted(InvalidInput):
    """Only an accepted booking can be confirmed complete."""

    code = "complete_only_accepted"
    default_message = "Only accepted bookings can be marked complete."


class CompleteNeedsPayment(InvalidInput):
    """The client has not paid, so the booking cannot be confirmed complete."""

    code = "complete_needs_payment"
    default_message = "Payment must be completed before this booking can be marked complete."


class EventDayNotOver(InvalidInput):
    """Completion is confirmed after the event's last day ends."""

    code = "event_day_not_over"
    default_message = "You can confirm the event is complete after the event day has ended."


# --- money steps the payments slice will own ---------------------------------------------------------


class CancelNeedsPayments(Unavailable):
    """Cancelling a paid or mid-checkout booking refunds or closes it in Stripe; not rebuilt yet."""

    code = "booking_cancel_needs_payments"
    default_message = "This booking can't be cancelled here yet because a payment is in progress or taken."


class PayoutReleaseNotRebuilt(Unavailable):
    """Both parties confirmed; paying the vendor is a Stripe transfer the payments slice will make."""

    code = "booking_payout_release_unavailable"
    # The party's confirmation still counts; only the transfer waits.
    persist_effects = True
    default_message = "We could not release the payout right now. Please try again later."
