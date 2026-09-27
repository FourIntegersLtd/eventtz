"""The client pays: open a Stripe Checkout Session, and mark the booking paid when it completes.

Checkout re-prices the booking from the vendor's stored price list (`vendors.payload`)
and the event date, never from anything the client sends, and charges that total into
Eventtz's own balance; the vendor is paid later by an explicit Transfer (held funds).
A completed session reaches `finalize_checkout_session` from the Stripe webhook or, if
the webhook is slow, from the client's sync after the redirect. Either way the booking
is marked paid by one conditional write, so a duplicate delivery changes nothing.
A payment that arrives for a booking that can no longer take it is refunded in full.

Ported from the baseline's `payment_checkout.py` and `payment_finalize.py`.
"""

from __future__ import annotations

from typing import Any, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway, PaymentGatewayError, PaymentsUnavailable
from app.core.settings import get_settings
from app.features.bookings import domain_payments, repository, service_pricing, service_receipts
from app.features.bookings.errors import (
    BookingNoLongerPayable,
    CheckoutAlreadyPaid,
    CheckoutBookingNotFound,
    CheckoutMissingEventDate,
    CheckoutPricesToConfirm,
    CheckoutSessionAccountMismatch,
    CheckoutSessionMismatch,
    CheckoutVendorUnavailable,
    EventAddressRequiredToPay,
    NoCheckoutSession,
    NothingToPay,
    OnlyAcceptedCanBePaid,
    PaymentLinkExpired,
    PaymentNotFinished,
    VendorPayoutsNotReady,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.service_common import announce_change
from app.features.identity import service as identity
from app.features.marketplace import service_events as events
from app.features.marketplace import service_explore
from app.features.notifications import service_booking as notices
from app.features.notifications.service_payment_alerts import (
    PAYMENT_RECEIVED_CLIENT_BODY,
    VENDOR_PAYMENT_RECEIVED_BODY,
)
from app.features.pricing import service as pricing
from app.features.vendors import service_catalogue
from app.features.vendors import service_payouts as vendor_payouts

log = get_logger(__name__)

# The refund idempotency suffixes, one per reason a completed payment is handed back.
# A redelivered webhook reuses the key, so Stripe refunds at most once per reason.
_SUFFIX_NOT_ACCEPTED = "stale-checkout-not-accepted"
_SUFFIX_STALE_SESSION = "stale-checkout-session"
_SUFFIX_NOT_ELIGIBLE = "checkout-not-eligible"


# --- start checkout ------------------------------------------------------------------------------------


async def _check_vendor_can_be_paid(session: AsyncSession, vendor_user_id: str) -> None:
    """Refuse unless the vendor's Connect account takes charges, or staff waived the payout gate.

    A waiver is safe here: Checkout collects into Eventtz's balance and never touches
    the vendor's account; only the completion Transfer does, and it waits for them.
    """
    vendor = await vendor_payouts.vendor_for_payouts(session, vendor_user_id)
    charges_ready = (
        vendor is not None and bool(vendor.stripe_account_id) and bool(vendor.stripe_charges_enabled)
    )
    if not charges_ready and not vendor_payouts.payout_gate_waived(vendor):
        raise VendorPayoutsNotReady()


async def _repriced(session: AsyncSession, booking: BookingRow) -> tuple[list[Any], pricing.PricingBreakdown]:
    """The booking's line items and price today, from the vendor's stored price list and the event date.

    Automatic discounts (early booking, off-peak days…) are re-applied for the event
    date, so a client cannot keep a discount the vendor has since withdrawn.
    """
    vendor_payload = await service_explore.bookable_vendor_payload(
        session, booking.vendor_user_id, viewer=None
    )
    if not vendor_payload:
        raise CheckoutVendorUnavailable()
    event_date = domain_payments.parse_event_date(booking.event_date)
    if event_date is None:
        raise CheckoutMissingEventDate()
    line_items = service_catalogue.reconcile_automatic_discount_lines(
        cast(list[dict[str, Any]], booking.line_items), vendor_payload, event_date
    )
    repriced_booking = booking.model_copy(update={"line_items": line_items})
    breakdown = service_pricing.breakdown_for(
        repriced_booking, await service_pricing.code_owners_for(session, [repriced_booking])
    )
    if breakdown.has_pricing_tbc:
        raise CheckoutPricesToConfirm()
    if breakdown.vendor_portion_gbp <= 0:
        raise NothingToPay()
    return line_items, breakdown


async def start_checkout(
    session: AsyncSession, gateway: PaymentGateway, *, client_user_id: str, booking_id: str
) -> str:
    """Re-price the client's accepted booking and open a Checkout Session for it; returns its URL."""
    booking = await repository.get_booking(session, booking_id, client_user_id=client_user_id)
    if booking is None:
        raise CheckoutBookingNotFound()
    if booking.status != "accepted":
        raise OnlyAcceptedCanBePaid()
    if booking.payment_status not in domain_payments.PAYABLE_PAYMENT_STATUSES:
        raise CheckoutAlreadyPaid()
    await _check_vendor_can_be_paid(session, booking.vendor_user_id)

    line_items, breakdown = await _repriced(session, booking)
    await repository.update_booking(
        session,
        booking_id,
        {"line_items": line_items, **service_pricing.snapshot_columns(breakdown)},
        client_user_id=client_user_id,
    )
    if breakdown.client_total_gbp <= 0:
        raise NothingToPay()
    if not (booking.event_address or "").strip():
        raise EventAddressRequiredToPay()

    client_email = (await identity.emails_by_id(session, [client_user_id])).get(client_user_id)
    success_url, cancel_url = domain_payments.checkout_urls(get_settings().frontend_url, booking_id)
    # No fixed idempotency key: opening a session takes no money, and reusing a key
    # could hand back an old expired link. Refunds and transfers always carry one.
    checkout = await gateway.create_checkout_session(
        amount_pence=domain_payments.gbp_to_pence(breakdown.client_total_gbp),
        description=domain_payments.checkout_description(booking.event_name),
        metadata=domain_payments.checkout_metadata(
            booking_id=booking_id,
            vendor_user_id=booking.vendor_user_id,
            client_user_id=client_user_id,
            client_total_gbp=breakdown.client_total_gbp,
            vendor_amount_gbp=breakdown.vendor_portion_gbp,
            service_fee_gbp=breakdown.service_fee_gbp,
            referral_fee_discount_gbp=breakdown.referral_fee_discount_gbp or 0.0,
        ),
        customer_email=client_email or None,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    await repository.update_booking(
        session,
        booking_id,
        {"stripe_checkout_session_id": checkout.session_id, "payment_status": "pending"},
        client_user_id=client_user_id,
        payment_status_in=domain_payments.PAYABLE_PAYMENT_STATUSES,
    )
    # The funnel's "payment requested" moment is the first checkout, not the latest.
    await repository.update_booking(
        session, booking_id, {}, unset_column="payment_requested_at", now_columns=("payment_requested_at",)
    )
    await events.record_marketplace_event(
        session,
        "customer_started_payment",
        actor_user_id=client_user_id,
        vendor_user_id=booking.vendor_user_id,
        booking_request_id=booking_id,
        booking_value_gbp=breakdown.client_total_gbp,
    )
    return checkout.url


# --- finalise a completed session ----------------------------------------------------------------------


async def refund_checkout_payment(
    session: AsyncSession,
    gateway: PaymentGateway,
    checkout_session: dict[str, Any],
    booking_id: str,
    *,
    suffix: str,
) -> bool:
    """Refund a completed Checkout payment in full when the booking cannot take it; True once refunded.

    The idempotency key names the booking and the reason, so a redelivered event
    never refunds twice. A failure is logged, not raised: the webhook must still answer 2xx.
    """
    payment_intent_id = domain_payments.payment_intent_id_from_session(checkout_session)
    if not payment_intent_id:
        log.error("bookings: cannot refund checkout booking=%s: session has no payment_intent", booking_id)
        return False
    try:
        await gateway.create_refund(
            payment_intent_id=payment_intent_id,
            amount_pence=None,
            metadata={"booking_id": booking_id},
            idempotency_key=domain_payments.refund_idempotency_key(booking_id, suffix),
        )
    except (PaymentGatewayError, PaymentsUnavailable):
        log.exception(
            "bookings: checkout refund failed booking=%s payment_intent=%s suffix=%s",
            booking_id,
            payment_intent_id,
            suffix,
        )
        return False
    await repository.update_booking(
        session,
        booking_id,
        {"payment_status": domain_payments.REFUNDED},
        payment_status_in=domain_payments.CHECKOUT_REFUNDABLE_STATUSES,
    )
    log.info(
        "bookings: refunded checkout booking=%s payment_intent=%s suffix=%s",
        booking_id,
        payment_intent_id,
        suffix,
    )
    return True


async def _charge_fields(gateway: PaymentGateway, checkout_session: dict[str, Any]) -> dict[str, Any]:
    """The payment intent, charge and receipt URL to store; each is None when Stripe cannot say.

    These are for records and receipts only, so a failed lookup never blocks marking the booking paid.
    """
    payment_intent_id = domain_payments.payment_intent_id_from_session(checkout_session)
    charge_id = domain_payments.charge_id_from_session(checkout_session)
    if payment_intent_id and not charge_id:
        try:
            payment_intent = await gateway.retrieve_payment_intent(payment_intent_id)
            charge_id = domain_payments.charge_id_from_payment_intent(payment_intent)
        except (PaymentGatewayError, PaymentsUnavailable):
            log.exception("bookings: could not retrieve payment intent %s", payment_intent_id)
    receipt_url: str | None = None
    usable_charge = domain_payments.usable_charge_id(charge_id)
    if usable_charge:
        try:
            charge = await gateway.retrieve_charge(usable_charge)
            receipt_url = str(charge.get("receipt_url") or "").strip() or None
        except (PaymentGatewayError, PaymentsUnavailable):
            log.exception("bookings: could not retrieve charge %s for its receipt URL", usable_charge)
    return {
        "stripe_payment_intent_id": payment_intent_id,
        "stripe_charge_id": charge_id,
        "stripe_receipt_url": receipt_url,
    }


async def _handle_not_marked_paid(
    session: AsyncSession, gateway: PaymentGateway, checkout_session: dict[str, Any], booking_id: str
) -> None:
    """The paid write matched nothing: a duplicate (already paid), or a booking that moved on (refund)."""
    reloaded = await repository.get_booking(session, booking_id)
    status = reloaded.status if reloaded is not None else ""
    payment_status = reloaded.payment_status if reloaded is not None else ""
    if payment_status in domain_payments.PAID_PAYMENT_STATUSES:
        log.info(
            "bookings: checkout duplicate for already-paid booking=%s payment=%s", booking_id, payment_status
        )
    elif status != "accepted" or payment_status not in domain_payments.PAYABLE_PAYMENT_STATUSES:
        log.warning(
            "bookings: checkout booking=%s no longer payable status=%s payment=%s; refunding",
            booking_id,
            status,
            payment_status,
        )
        await refund_checkout_payment(
            session, gateway, checkout_session, booking_id, suffix=_SUFFIX_NOT_ELIGIBLE
        )
    else:
        log.info("bookings: checkout booking=%s not eligible for payment; skipping", booking_id)


async def finalize_checkout_session(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, checkout_session: dict[str, Any]
) -> bool:
    """Mark the session's booking paid; True only when this call is the one that marked it.

    Refuses (and refunds) a session for a booking that is no longer accepted, or one
    that a newer checkout replaced. Refuses a charged amount that differs from the
    total the server priced, so a tampered session is never accepted as payment.
    """
    metadata = checkout_session.get("metadata") or {}
    booking_id = str(metadata.get("booking_id") or "").strip()
    if not booking_id:
        log.warning("bookings: checkout session %s has no booking_id metadata", checkout_session.get("id"))
        return False
    booking = await repository.get_booking(session, booking_id)
    if booking is None:
        log.warning("bookings: checkout session for unknown booking %s", booking_id)
        return False
    if booking.status != "accepted":
        log.warning("bookings: checkout for booking %s in status=%s; refunding", booking_id, booking.status)
        await refund_checkout_payment(
            session, gateway, checkout_session, booking_id, suffix=_SUFFIX_NOT_ACCEPTED
        )
        return False
    session_id = str(checkout_session.get("id") or "").strip()
    stored_session_id = (booking.stripe_checkout_session_id or "").strip()
    if stored_session_id and session_id and stored_session_id != session_id:
        log.warning(
            "bookings: stale checkout session booking=%s session=%s current=%s; refunding",
            booking_id,
            session_id,
            stored_session_id,
        )
        await refund_checkout_payment(
            session, gateway, checkout_session, booking_id, suffix=_SUFFIX_STALE_SESSION
        )
        return False

    amount_total = checkout_session.get("amount_total")
    # bool is an int in Python; Stripe never sends one, so treat it as missing.
    if not isinstance(amount_total, (int, float)) or isinstance(amount_total, bool):
        log.warning("bookings: checkout session missing amount_total booking=%s", booking_id)
        return False
    expected_pence = domain_payments.expected_checkout_pence(metadata)
    if expected_pence is None:
        log.warning("bookings: checkout session metadata missing pricing booking=%s", booking_id)
        return False
    if int(amount_total) != expected_pence:
        log.warning(
            "bookings: checkout amount mismatch booking=%s charged=%s expected=%s",
            booking_id,
            amount_total,
            expected_pence,
        )
        return False

    payment_amount_gbp = domain_payments.pence_to_gbp(int(amount_total))
    marked_paid = await repository.update_booking(
        session,
        booking_id,
        {
            "payment_status": domain_payments.PAID,
            **await _charge_fields(gateway, checkout_session),
            "payment_amount_gbp": payment_amount_gbp,
            "vendor_amount_gbp": domain_payments.metadata_amount_gbp(metadata, "vendor_amount_gbp"),
            "platform_fee_gbp": domain_payments.metadata_amount_gbp(metadata, "service_fee_gbp"),
            "referral_fee_discount_gbp": domain_payments.metadata_amount_gbp(
                metadata, "referral_fee_discount_gbp"
            ),
        },
        status_in=("accepted",),
        payment_status_in=domain_payments.PAYABLE_PAYMENT_STATUSES,
        now_columns=("paid_at",),
    )
    if not marked_paid:
        await _handle_not_marked_paid(session, gateway, checkout_session, booking_id)
        return False

    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking_id,
        kind="payment_received",
        body=PAYMENT_RECEIVED_CLIENT_BODY,
        send_email=False,
    )
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking_id,
        kind="vendor_payment_received",
        body=VENDOR_PAYMENT_RECEIVED_BODY,
        send_email=False,
    )
    announce_change(session, booking)
    await events.record_marketplace_event(
        session,
        "customer_payment_completed",
        actor_user_id=booking.client_user_id,
        vendor_user_id=booking.vendor_user_id,
        booking_request_id=booking_id,
        booking_value_gbp=payment_amount_gbp,
    )
    try:
        await service_receipts.freeze_after_checkout(session, mailer, booking_id)
    except Exception:
        log.warning("bookings: receipt freeze after checkout failed booking=%s", booking_id, exc_info=True)
    return True


# --- the client's sync after the redirect --------------------------------------------------------------


async def _retrieve_client_session(
    session: AsyncSession, gateway: PaymentGateway, *, client_user_id: str, booking_id: str, session_id: str
) -> dict[str, Any]:
    """The Checkout Session from Stripe; a session Stripe no longer knows is cleared from the booking."""
    try:
        return await gateway.retrieve_checkout_session(session_id)
    except PaymentGatewayError as error:
        if not domain_payments.is_missing_checkout_session(error.stripe_code, str(error)):
            raise
        log.warning(
            "bookings: stale checkout session booking=%s session=%s; clearing", booking_id, session_id
        )
        await repository.update_booking(
            session,
            booking_id,
            {"stripe_checkout_session_id": None, "payment_status": "unpaid"},
            client_user_id=client_user_id,
            payment_status_in=domain_payments.PAYABLE_PAYMENT_STATUSES,
        )
        raise PaymentLinkExpired() from error


async def sync_checkout(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    client_user_id: str,
    booking_id: str,
    session_id: str | None,
) -> str:
    """Check the client's Checkout Session with Stripe and mark the booking paid if the webhook has not.

    Returns the booking's payment status. A booking already settled is answered
    without asking Stripe.
    """
    booking = await repository.get_booking(session, booking_id, client_user_id=client_user_id)
    if booking is None:
        raise CheckoutBookingNotFound()
    if booking.status != "accepted":
        raise BookingNoLongerPayable()
    if booking.payment_status in domain_payments.SETTLED_PAYMENT_STATUSES:
        return booking.payment_status

    resolved_session_id = (session_id or "").strip() or (booking.stripe_checkout_session_id or "").strip()
    if not resolved_session_id:
        raise NoCheckoutSession()
    checkout_session = await _retrieve_client_session(
        session, gateway, client_user_id=client_user_id, booking_id=booking_id, session_id=resolved_session_id
    )
    metadata = checkout_session.get("metadata") or {}
    if str(metadata.get("booking_id") or "").strip() != booking_id:
        raise CheckoutSessionMismatch()
    if str(metadata.get("client_user_id") or "").strip() != client_user_id:
        raise CheckoutSessionAccountMismatch()
    if str(checkout_session.get("payment_status") or "") != "paid":
        raise PaymentNotFinished()

    await finalize_checkout_session(session, mailer, gateway, checkout_session)
    refreshed = await repository.get_booking(session, booking_id, client_user_id=client_user_id)
    if refreshed is None:
        raise CheckoutBookingNotFound()
    if refreshed.payment_status not in domain_payments.PAID_PAYMENT_STATUSES:
        raise PaymentNotFinished()
    return refreshed.payment_status
