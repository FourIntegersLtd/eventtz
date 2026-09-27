"""Read payment receipts, vendor payment records and payout statements for the signed-in party."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Forbidden
from app.core.logging import get_logger
from app.core.ports import PaymentGateway, PaymentGatewayError, PaymentsUnavailable
from app.features.bookings import domain_receipts, repository_receipts, service_pricing
from app.features.bookings.errors import (
    BookingNotFound,
    ReceiptNotAvailable,
    ReceiptStripeVerifyFailed,
)
from app.features.bookings.rows import ReceiptBookingRow
from app.features.bookings.schemas_receipts import PaymentReceiptPayload, PaymentReceiptResponse
from app.features.identity import service as identity
from app.features.vendors import service_listing

log = get_logger(__name__)

_UNKNOWN_VENDOR_NAME = "Vendor"


def _has_frozen_client_receipt(booking: ReceiptBookingRow) -> bool:
    """True when a write-once client receipt snapshot is already stored on the row."""
    frozen = booking.payment_receipt_snapshot
    return isinstance(frozen, dict) and frozen.get("document_type") == "client_payment_receipt"


def _amount_pence(amount_gbp: float) -> int:
    """Stripe pence for a GBP float, rounded like the baseline."""
    return int(round(amount_gbp * 100))


async def _verify_client_receipt_with_stripe(gateway: PaymentGateway, booking: ReceiptBookingRow) -> None:
    """Re-fetch Stripe for legacy rows that have no frozen client snapshot yet."""
    has_frozen = _has_frozen_client_receipt(booking)
    payment_intent_id = str(booking.stripe_payment_intent_id or "").strip()
    if not payment_intent_id.startswith("pi_"):
        if has_frozen:
            return
        raise ReceiptStripeVerifyFailed()

    expected_amount: float | None
    try:
        raw_amount = booking.payment_amount_gbp
        expected_amount = float(raw_amount) if raw_amount is not None else None
    except (TypeError, ValueError):
        expected_amount = None

    try:
        payment_intent = await gateway.retrieve_payment_intent(payment_intent_id)
    except PaymentsUnavailable as error:
        if has_frozen:
            return
        raise ReceiptStripeVerifyFailed() from error
    except PaymentGatewayError as error:
        if error.stripe_code == "resource_missing":
            log.warning(
                "Receipt verify: PaymentIntent %s not in current Stripe account; serving from snapshot",
                payment_intent_id,
            )
            return
        if has_frozen and error.http_status >= 500:
            return
        raise ReceiptStripeVerifyFailed() from error

    if str(payment_intent.get("status") or "") != "succeeded":
        raise Forbidden(message="Payment is not completed.")

    if expected_amount is None:
        return

    try:
        amount_received_pence = int(payment_intent.get("amount_received") or 0)
        expected_pence = _amount_pence(expected_amount)
    except (TypeError, ValueError) as error:
        raise ReceiptStripeVerifyFailed() from error

    if amount_received_pence != expected_pence:
        log.warning(
            "Receipt verify amount mismatch pi=%s stored_gbp=%s stripe_pence=%s expected_pence=%s",
            payment_intent_id,
            expected_amount,
            amount_received_pence,
            expected_pence,
        )
        raise ReceiptStripeVerifyFailed()


def payment_receipt_response(payload: dict[str, Any]) -> PaymentReceiptResponse:
    """Validate a builder payload before returning it from a route."""
    try:
        return PaymentReceiptResponse(receipt=PaymentReceiptPayload(**payload))
    except ValidationError as error:
        raise ReceiptNotAvailable() from error


async def _booking_for_client(
    session: AsyncSession, *, client_user_id: str, booking_id: str
) -> ReceiptBookingRow:
    """Load the booking for the client or answer as missing."""
    booking = await repository_receipts.get_booking_for_receipt(
        session, booking_id, client_user_id=client_user_id
    )
    if booking is None:
        raise BookingNotFound()
    return booking


async def _booking_for_vendor(
    session: AsyncSession, *, vendor_user_id: str, booking_id: str
) -> ReceiptBookingRow:
    """Load the booking for the vendor or answer as missing."""
    booking = await repository_receipts.get_booking_for_receipt(
        session, booking_id, vendor_user_id=vendor_user_id
    )
    if booking is None:
        raise BookingNotFound()
    return booking


async def client_receipt(
    session: AsyncSession,
    gateway: PaymentGateway,
    *,
    client_user_id: str,
    booking_id: str,
) -> dict[str, Any]:
    """The client's payment receipt JSON payload."""
    booking = await _booking_for_client(session, client_user_id=client_user_id, booking_id=booking_id)
    await _verify_client_receipt_with_stripe(gateway, booking)
    vendor_names = await service_listing.display_names(session, [booking.vendor_user_id])
    vendor_name = vendor_names.get(booking.vendor_user_id, _UNKNOWN_VENDOR_NAME)
    pricing = (await service_pricing.current_breakdown(session, booking)).to_dict()

    try:
        return domain_receipts.payload_from_frozen_or_build(
            booking=booking,
            document_type="client_payment_receipt",
            build_live=lambda: domain_receipts.build_client_payment_receipt(
                booking, pb=pricing, vendor_display_name=vendor_name
            ),
        )
    except ReceiptNotAvailable:
        raise


async def vendor_payment_record(
    session: AsyncSession,
    *,
    vendor_user_id: str,
    booking_id: str,
) -> dict[str, Any]:
    """The vendor's payment record JSON payload."""
    booking = await _booking_for_vendor(session, vendor_user_id=vendor_user_id, booking_id=booking_id)
    client_names = await identity.client_display_names(session, [booking.client_user_id])
    client_name = client_names.get(booking.client_user_id, "Client")
    pricing = (await service_pricing.current_breakdown(session, booking)).to_dict()

    try:
        return domain_receipts.payload_from_frozen_or_build(
            booking=booking,
            document_type="vendor_payment_record",
            build_live=lambda: domain_receipts.build_vendor_payment_record(
                booking, pb=pricing, client_display_name=client_name
            ),
        )
    except ReceiptNotAvailable:
        raise


async def vendor_payout_statement(
    session: AsyncSession,
    *,
    vendor_user_id: str,
    booking_id: str,
) -> dict[str, Any]:
    """The vendor's payout statement JSON payload."""
    booking = await _booking_for_vendor(session, vendor_user_id=vendor_user_id, booking_id=booking_id)
    client_names = await identity.client_display_names(session, [booking.client_user_id])
    client_name = client_names.get(booking.client_user_id, "Client")
    pricing = (await service_pricing.current_breakdown(session, booking)).to_dict()

    try:
        return domain_receipts.payload_from_frozen_or_build(
            booking=booking,
            document_type="vendor_payout_statement",
            build_live=lambda: domain_receipts.build_vendor_payout_statement(
                booking, pb=pricing, client_display_name=client_name
            ),
        )
    except ReceiptNotAvailable:
        raise


def render_receipt_html(payload: dict[str, Any]) -> str:
    """HTML for a receipt document, byte-for-byte like the baseline renderer."""
    from app.features.notifications import service as notifications_service

    return notifications_service.render_receipt_document(payload)
