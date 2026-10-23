"""Errors the bookings slice raises. Messages are the baseline's user-facing copy, verbatim.

The baseline answered almost every booking rule with a 400 carrying one of these
messages (and a 404 for a booking the caller cannot see); the statuses are kept so
the web keeps working, and each now has a stable code.
"""

from __future__ import annotations

from app.core.errors import AppError, Conflict, InvalidInput, NotFound, Unavailable


class UnknownReminderColumn(AppError):
    """500: code asked to stamp a column that is not an enquiry-reminder timestamp (a programming error)."""

    code = "unknown_reminder_column"
    default_message = "Something went wrong"


# --- ids and lookups -------------------------------------------------------------------------------


class BookingNotFound(NotFound):
    """No booking with that id that the caller is a party to (someone else's looks missing too)."""

    code = "booking_not_found"
    default_message = "Booking not found."


class InvalidBookingId(InvalidInput):
    """The booking id in the path is not a UUID."""

    code = "invalid_booking_id"
    default_message = "Invalid booking id."


class ReceiptNotAvailable(NotFound):
    """The payment has not reached a state this receipt/record/statement may be read in yet.

    Baseline used this same message for all three documents (a payout-statement-specific
    message exists in baseline's `messages.py` but is never actually raised anywhere).
    """

    code = "receipt_not_available"
    default_message = "No receipt is available for this booking yet."


class ReceiptStripeVerifyPaymentIntentMissing(NotFound):
    """No `pi_` on file and no frozen client snapshot yet (acceptance unpaid / legacy rows)."""

    code = "receipt_stripe_verify_failed"
    default_message = "Unable to verify payment with Stripe. Please try again later."


class ReceiptStripeVerifyFailed(Unavailable):
    """Stripe could not confirm the payment (transient or amount mismatch); retry later.

    When a frozen client snapshot exists, the route serves it instead of raising this.
    """

    code = "receipt_stripe_verify_failed"
    default_message = "Unable to verify payment with Stripe. Please try again later."


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


class InvalidPaymentStatusFilter(InvalidInput):
    """The `payment_status` list filter names a value that is not a payment status."""

    code = "booking_invalid_payment_status"
    default_message = "Query parameter payment_status must be a comma-separated list of payment statuses."


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


class CancelOnSupportHold(InvalidInput):
    """A booking support has put on hold (for example a card chargeback) cannot be cancelled or refunded."""

    code = "cancel_on_support_hold"
    default_message = (
        "This booking is on hold with our support team. It can't be cancelled until that's cleared."
    )


# --- payout guard (every path that pays the vendor) -------------------------------------------------


class PayoutBlockedByDispute(InvalidInput):
    """An open problem report holds the vendor's payout until staff resolve it."""

    code = "payout_blocked_by_dispute"
    default_message = "This booking has an open problem report. The payout is held until it's resolved."


class PayoutOnSupportHold(InvalidInput):
    """Support put the booking on hold (for example a card chargeback): no payout until cleared."""

    code = "payout_on_support_hold"
    default_message = "This booking is on hold with our support team. The payout is held until it's cleared."


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


# --- refunds and payouts (`service_payments.py`) -----------------------------------------------------
#
# The baseline raised these as ValueError, answered 400, so they keep that status.


class OnlyPaidCanRefund(InvalidInput):
    """Only money actually held (payment status paid) can be refunded."""

    code = "refund_only_paid"
    default_message = "Only paid bookings can be refunded."


class NoPaymentOnRecord(InvalidInput):
    """The booking is marked paid but no Stripe payment intent was stored, so there is nothing to refund."""

    code = "refund_no_payment_on_record"
    default_message = "No payment on record for this booking."


class RefundFailed(InvalidInput):
    """Stripe refused the refund; staff are emailed and the booking is left as it was."""

    code = "refund_failed"
    default_message = "We couldn't process the refund right now. Please try again shortly."


class RefundedButBookingChanged(BookingNotFound):
    """The refund went through but the cancel lost a race; the refund is still recorded."""

    # Stripe has refunded, so the booking must say so even though the cancel did not happen.
    persist_effects = True


class OnlyPaidPayoutRelease(InvalidInput):
    """Staff can release a payout only while the client's payment is held."""

    code = "payout_only_paid"
    default_message = "Only paid bookings can have their payout released."


class PayoutAmountMissing(InvalidInput):
    """The booking has no vendor share to transfer; staff are emailed."""

    code = "payout_amount_missing"
    # The confirmation and the once-per-booking ops alert are kept.
    persist_effects = True
    default_message = "Payout amount is missing for this booking. Please contact support."


class PayoutReleaseFailed(InvalidInput):
    """Stripe refused the Transfer; staff are emailed once and a later retry can succeed."""

    code = "payout_release_failed"
    # The confirmation and the once-per-booking ops alert are kept.
    persist_effects = True
    default_message = "We couldn't release the payout right now. Please try again shortly."


# --- checkout (the client pays) ---------------------------------------------------------------------
#
# The baseline answered every checkout refusal with a 400, including "not found", so these keep it.


class CheckoutBookingNotFound(InvalidInput):
    """Checkout or its sync named a booking the client does not have (a 400, as the baseline answered)."""

    code = "checkout_booking_not_found"
    default_message = "Booking not found."


class OnlyAcceptedCanBePaid(InvalidInput):
    """Checkout opens only once the vendor has accepted."""

    code = "checkout_only_accepted"
    default_message = "Only accepted bookings can be paid."


class CheckoutAlreadyPaid(InvalidInput):
    """The booking's money is already settled, so there is nothing to check out."""

    code = "checkout_already_paid"
    default_message = "This booking has already been paid."


class VendorPayoutsNotReady(InvalidInput):
    """The vendor cannot take card payments yet and staff have not waived the payout gate."""

    code = "checkout_vendor_payouts_not_ready"
    default_message = "This vendor hasn't finished setting up payouts yet. Try again once they have."


class CheckoutVendorUnavailable(InvalidInput):
    """The vendor is no longer bookable (unlisted, banned or closed), so their prices cannot be read."""

    code = "checkout_vendor_unavailable"
    default_message = "This vendor is not available for booking right now."


class CheckoutMissingEventDate(InvalidInput):
    """The stored event date cannot be read, so date-based discounts cannot be priced."""

    code = "checkout_missing_event_date"
    default_message = "Booking is missing a valid event date."


class CheckoutPricesToConfirm(InvalidInput):
    """A line is still "price to be confirmed", so there is no total to charge."""

    code = "checkout_prices_to_confirm"
    default_message = "This booking still has prices to be confirmed before you can pay."


class NothingToPay(InvalidInput):
    """The re-priced total is zero."""

    code = "checkout_nothing_to_pay"
    default_message = "Nothing to pay for this booking."


class EventAddressRequiredToPay(InvalidInput):
    """The vendor needs the event address, so it is asked for before the client pays."""

    code = "checkout_event_address_required"
    default_message = "Add your event address on the booking before paying. Your vendor needs it to prepare."


class BookingNoLongerPayable(InvalidInput):
    """A payment sync for a booking that is no longer accepted."""

    code = "checkout_no_longer_payable"
    default_message = "This booking can no longer be paid."


class NoCheckoutSession(InvalidInput):
    """A payment sync with no session id given and none stored."""

    code = "checkout_no_session"
    default_message = "No checkout session found for this booking."


class PaymentLinkExpired(InvalidInput):
    """Stripe no longer knows the session (it expired, or Stripe accounts changed); it was cleared."""

    code = "checkout_payment_link_expired"
    # The stale session is cleared so the next "Pay now" starts fresh; that write must stick.
    persist_effects = True
    default_message = "That payment link has expired. Tap Pay now to start a fresh checkout."


class CheckoutSessionMismatch(InvalidInput):
    """The session Stripe returned belongs to another booking."""

    code = "checkout_session_mismatch"
    default_message = "This checkout session does not match this booking."


class CheckoutSessionAccountMismatch(InvalidInput):
    """The session Stripe returned was opened by another client."""

    code = "checkout_session_account_mismatch"
    default_message = "This checkout session does not match your account."


class PaymentNotFinished(InvalidInput):
    """Stripe has not marked the session paid yet (or finalising did not mark the booking paid)."""

    code = "checkout_payment_not_finished"
    # Finalising may have refunded a stale payment; that write must stick.
    persist_effects = True
    default_message = "Payment has not finished processing yet. Wait a moment and refresh."


# --- admin console (staff/super admin) ----------------------------------------------------------------
#
# The admin console's own copy differs, in small ways, from the client/vendor errors above (for
# instance `AdminBookingNotFound`'s message has no trailing period, unlike `BookingNotFound`'s),
# because the baseline's `admin` feature kept its own `messages.py` rather than sharing one.


class AdminBookingNotFound(NotFound):
    """No booking with that id (the admin console's own wording, without the trailing period)."""

    code = "admin_booking_not_found"
    default_message = "Booking not found"


class NoPaymentFieldsToUpdate(InvalidInput):
    """The payment-fields patch body set nothing."""

    code = "no_payment_fields_to_update"
    default_message = "No fields to update"


class StripePaymentIntentRequiredForAmount(InvalidInput):
    """Setting `payment_amount_gbp` needs a payment intent to verify it against (given or already stored)."""

    code = "stripe_pi_required_for_amount"
    default_message = "stripe_payment_intent_id is required to set payment_amount_gbp."


class StripeVerificationFailed(Unavailable):
    """Stripe could not be reached to verify the payment intent."""

    code = "stripe_verify_failed"
    default_message = "Could not verify payment with Stripe. Try again later."


class StripePaymentIntentNoConfirmedAmount(InvalidInput):
    """The payment intent has no `amount_received` (or successful `amount`) to record."""

    code = "stripe_pi_no_confirmed_amount"
    default_message = "Stripe payment intent has no confirmed amount."


class StripeChargeUnverified(InvalidInput):
    """The payment intent has no charge yet, so `stripe_charge_id` cannot be checked against it."""

    code = "stripe_charge_unverified"
    default_message = "Could not verify stripe_charge_id - payment intent has no charge yet."


class StripeChargeMismatch(InvalidInput):
    """The given `stripe_charge_id` is not the payment intent's charge."""

    code = "stripe_charge_mismatch"
    default_message = "stripe_charge_id does not match the payment intent."


class CouldNotUpdatePaymentFields(InvalidInput):
    """The payment-fields write matched no row (the booking id was valid but nothing changed)."""

    code = "could_not_update_payment_fields"
    default_message = "Could not update payment fields"


class OnlyUnpaidOrPendingCanBeReset(InvalidInput):
    """Only an unpaid or pending-checkout booking's stale session can be cleared."""

    code = "only_unpaid_pending_reset"
    default_message = "Only unpaid or pending checkout bookings can be reset."


# --- admin recovery tools (`service_admin_recovery.py`) ---------------------------------------------
#
# The baseline's recovery commands raised a plain ValueError for every refusal, a missing
# booking included, and each route answered it with a 400; these keep that status and copy.


class RecoveryBookingNotFound(InvalidInput):
    """No booking with that id (the recovery tools answer 400 here, not 404, as the baseline did)."""

    code = "recovery_booking_not_found"
    default_message = "Booking not found."


class RecoveryOnlyAcceptedMarkPaid(InvalidInput):
    """Only an accepted booking's payment can be synced from Stripe."""

    code = "recovery_only_accepted_mark_paid"
    default_message = "Only accepted bookings can be marked paid."


class RecoveryCheckoutSessionNotFound(InvalidInput):
    """Stripe no longer knows the stored Checkout Session; the booking's checkout was reset."""

    code = "recovery_checkout_session_not_found"
    # The reset checkout is kept so the client can pay again.
    persist_effects = True
    default_message = "Checkout session not found in Stripe. Checkout was reset - verify charge manually."


class RecoveryNothingToSync(InvalidInput):
    """No Checkout Session or payment intent is stored, so there is nothing to ask Stripe about."""

    code = "recovery_nothing_to_sync"
    default_message = "No checkout session or payment intent on file to sync."


class RecoveryPaymentIntentNotSucceeded(InvalidInput):
    """The stored payment intent has not succeeded, so the booking is not paid."""

    code = "recovery_payment_intent_not_succeeded"
    default_message = "Payment intent is not in a succeeded state."


class RecoveryPaymentIntentMismatch(InvalidInput):
    """The payment intent's metadata names a different booking, or none at all."""

    code = "recovery_payment_intent_mismatch"
    default_message = "Payment intent does not match this booking."


class RecoveryPaymentIntentAmountMismatch(InvalidInput):
    """The payment intent's amount differs from the total its metadata says the server priced."""

    code = "recovery_payment_intent_amount_mismatch"
    default_message = "Payment intent amount does not match the priced total for this booking."


class RecoveryPaymentIntentNoAmount(InvalidInput):
    """The payment intent carries no confirmed amount to record."""

    code = "recovery_payment_intent_no_amount"
    default_message = "Payment intent has no confirmed amount."


class RecoveryMarkPaidFailed(InvalidInput):
    """The paid write matched nothing: the booking moved on while Stripe was being asked."""

    code = "recovery_mark_paid_failed"
    default_message = "Booking could not be marked paid - check status and payment state."


class RecoveryOnlyPaidPayoutRelease(InvalidInput):
    """Staff can release a payout only while the client's payment is held (the console's wording)."""

    code = "recovery_only_paid_payout_release"
    default_message = "Only paid bookings can have payout released."


class RecoveryPayoutNeedsAccepted(InvalidInput):
    """A paid booking that is no longer accepted cannot be paid out."""

    code = "recovery_payout_needs_accepted"
    default_message = "Booking must be accepted to release payout."


class RecoveryDisputeBlocksPayout(InvalidInput):
    """An open problem report holds the vendor's payout until staff resolve it."""

    code = "recovery_dispute_blocks_payout"
    default_message = "Open dispute blocks payout release."


class RecoveryPayoutNotEligible(InvalidInput):
    """Neither both confirmations nor the automatic payout date allow paying the vendor yet."""

    code = "recovery_payout_not_eligible"
    default_message = "Payout can only be released when both parties confirmed or auto-release is due."


class RecoveryPayoutNotReleased(InvalidInput):
    """The payout was attempted but the booking is not paid out (vendor Stripe not ready, or refused)."""

    code = "recovery_payout_not_released"
    # The payout-held notice and any ops alert are kept.
    persist_effects = True
    default_message = "Payout was not released - vendor Stripe account may not be ready or transfer failed."


class RecoveryOnlyRefundedCompleteCancel(InvalidInput):
    """Only a fully refunded booking can be closed as cancelled."""

    code = "recovery_only_refunded_complete_cancel"
    default_message = "Only refunded bookings can be completed as cancelled."


class RecoveryNotAcceptedRefunded(InvalidInput):
    """The refunded booking is not accepted any more, so there is no cancel left to complete."""

    code = "recovery_not_accepted_refunded"
    default_message = "Booking is not in accepted + refunded state."


class RecoveryCouldNotCompleteCancellation(InvalidInput):
    """The cancel write matched nothing: the booking changed meanwhile."""

    code = "recovery_could_not_complete_cancellation"
    default_message = "Could not complete cancellation."


class RecoveryReasonRequired(InvalidInput):
    """A cancel on a party's behalf needs the internal reason written down."""

    code = "recovery_reason_required"
    default_message = "Internal reason is required."


class RecoveryCouldNotCancel(InvalidInput):
    """The cancel write matched nothing: the booking changed meanwhile."""

    code = "recovery_could_not_cancel"
    # A refund already made in Stripe must stay recorded on the booking.
    persist_effects = True
    default_message = "Could not cancel booking."


class RecoveryPaymentRequiredMarkComplete(InvalidInput):
    """Completion can be confirmed on a party's behalf only once the client has paid."""

    code = "recovery_payment_required_mark_complete"
    default_message = "Payment must be completed before marking complete."


# --- rescheduling ------------------------------------------------------------------------------------


class DateChangeNotAllowed(Conflict):
    """A date change needs an accepted booking that is unpaid or paid (not cancelled or finished)."""

    code = "date_change_not_allowed"
    default_message = "The date can only be changed on an accepted booking that has not been completed."


class DateChangePending(Conflict):
    """A date change is already waiting for an answer."""

    code = "date_change_pending"
    default_message = "A date change is already waiting for an answer."


class NoDateChange(Conflict):
    """There is no pending date change to answer or withdraw."""

    code = "no_date_change"
    default_message = "There is no date change waiting on this booking."


class DateChangeNotYours(Conflict):
    """Only the other party may answer a date change, and only the requester may withdraw it."""

    code = "date_change_not_yours"
    default_message = "You cannot do that with this date change."


class DateChangeInPast(InvalidInput):
    """The proposed start date is before today, or the end is before the start."""

    code = "date_change_invalid_dates"
    default_message = "Choose a date that is today or later, with the end on or after the start."


class DateChangeCapacityFull(Conflict):
    """The vendor is fully booked on one of the proposed days, so the move cannot happen."""

    code = "date_change_capacity_full"
    default_message = "The vendor is fully booked on the new date, so the date could not be moved."


# --- Terms rules on money: payment deadline, split payouts, deposits (terms remediation 2.1, 3.1, 3.5) ---


class PartialRefundTooLarge(InvalidInput):
    """A staff partial refund larger than the payment less a held deposit and any upfront payout."""

    code = "partial_refund_too_large"
    default_message = (
        "That refund is more than can be returned: a held deposit and any payout already sent are excluded."
    )


class PaymentDeadlinePassed(Conflict):
    """The client tried to pay after the booking's payment deadline; it is about to be cancelled."""

    code = "payment_deadline_passed"
    default_message = "The time to pay for this booking has passed. Please send the vendor a new request."


class DeliveryNotAwaited(Conflict):
    """Delivery can be confirmed only on a split-payout booking whose first part has been paid."""

    code = "delivery_not_awaited"
    default_message = "This booking is not waiting for delivery to be confirmed."


class DepositClaimClosed(Conflict):
    """The vendor may claim a deposit only while it is held and the claim window is open."""

    code = "deposit_claim_closed"
    default_message = "A deposit claim cannot be made on this booking now."


class DepositClaimInvalid(InvalidInput):
    """A deposit claim needs an amount within the deposit and a description of what happened."""

    code = "deposit_claim_invalid"
    default_message = "Enter an amount up to the deposit and describe what was damaged or missing."


class NoDepositClaim(Conflict):
    """Staff tried to decide a deposit claim that does not exist or was already decided."""

    code = "no_deposit_claim"
    default_message = "There is no open deposit claim on this booking."


class DepositAwardInvalid(InvalidInput):
    """The amount awarded to the vendor must be between zero and what they claimed."""

    code = "deposit_award_invalid"
    default_message = "The award must be between £0 and the amount the vendor claimed."


class DepositVendorPayoutsNotReady(Conflict):
    """A deposit award cannot be sent until the vendor's Stripe payouts are set up."""

    code = "deposit_vendor_payouts_not_ready"
    default_message = "The vendor must finish Stripe payout setup before a deposit award can be sent."
