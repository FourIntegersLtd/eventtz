"""Read payment receipts, vendor payment records and payout statements for the signed-in party."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Forbidden
from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway, PaymentGatewayError, PaymentsUnavailable
from app.features.bookings import domain_receipts, repository_receipts, service_pricing
from app.features.bookings.errors import (
    BookingNotFound,
    ReceiptNotAvailable,
    ReceiptStripeVerifyFailed,
    ReceiptStripeVerifyPaymentIntentMissing,
)
from app.features.bookings.rows import ReceiptBookingRow
from app.features.bookings.schemas_receipts import PaymentReceiptPayload, PaymentReceiptResponse
from app.features.identity import service as identity
from app.features.notifications import service as notifications_service
from app.features.vendors import service_listing

log = get_logger(__name__)

_UNKNOWN_VENDOR_NAME = "Vendor"
_PAYMENT_NOT_COMPLETED = "Payment is not completed"


def _has_frozen_client_receipt(booking: ReceiptBookingRow) -> bool:
    """True when a write-once client receipt snapshot is already stored on the row."""
    frozen = booking.payment_receipt_snapshot
    return isinstance(frozen, dict) and frozen.get("document_type") == "client_payment_receipt"


def _amount_pence(amount_gbp: float) -> int:
    """Stripe pence for a GBP float, rounded like the baseline."""
    return int(round(amount_gbp * 100))


def _abort_stripe_verify_unless_frozen(has_frozen: bool) -> None:
    """Raise 503 when verify fails and there is no frozen client snapshot to serve."""
    if not has_frozen:
        raise ReceiptStripeVerifyFailed()


async def _verify_client_receipt_with_stripe(gateway: PaymentGateway, booking: ReceiptBookingRow) -> None:
    """Re-fetch Stripe for legacy rows that have no frozen client snapshot yet."""
    has_frozen = _has_frozen_client_receipt(booking)
    payment_intent_id = str(booking.stripe_payment_intent_id or "").strip()
    if not payment_intent_id.startswith("pi_"):
        if has_frozen:
            return
        raise ReceiptStripeVerifyPaymentIntentMissing()

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
        if has_frozen:
            return
        raise ReceiptStripeVerifyFailed() from error

    if str(payment_intent.get("status") or "") != "succeeded":
        raise Forbidden(message=_PAYMENT_NOT_COMPLETED)

    if expected_amount is None:
        return

    try:
        amount_received_pence = int(payment_intent.get("amount_received") or 0)
        expected_pence = _amount_pence(expected_amount)
    except (TypeError, ValueError):
        _abort_stripe_verify_unless_frozen(has_frozen)
        return

    if amount_received_pence != expected_pence:
        log.warning(
            "Receipt verify amount mismatch pi=%s stored_gbp=%s stripe_pence=%s expected_pence=%s",
            payment_intent_id,
            expected_amount,
            amount_received_pence,
            expected_pence,
        )
        _abort_stripe_verify_unless_frozen(has_frozen)


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


async def _client_receipt_payload(session: AsyncSession, booking: ReceiptBookingRow) -> dict[str, Any]:
    """Build or return the stored client receipt without pricing when frozen."""
    frozen = domain_receipts.frozen_payload_from_row(booking, "client_payment_receipt")
    if frozen is not None:
        return domain_receipts.overlay_live_payment_status(frozen, booking)
    vendor_names = await service_listing.display_names(session, [booking.vendor_user_id])
    vendor_name = vendor_names.get(booking.vendor_user_id, _UNKNOWN_VENDOR_NAME)
    pricing_breakdown = (await service_pricing.current_breakdown(session, booking)).to_dict()
    return domain_receipts.build_client_payment_receipt(
        booking, pricing_breakdown=pricing_breakdown, vendor_display_name=vendor_name
    )


async def _vendor_payment_record_payload(session: AsyncSession, booking: ReceiptBookingRow) -> dict[str, Any]:
    """Build or return the stored vendor payment record without pricing when frozen."""
    frozen = domain_receipts.frozen_payload_from_row(booking, "vendor_payment_record")
    if frozen is not None:
        return domain_receipts.overlay_live_payment_status(frozen, booking)
    client_names = await identity.client_display_names(session, [booking.client_user_id])
    client_name = client_names.get(booking.client_user_id, "Client")
    pricing_breakdown = (await service_pricing.current_breakdown(session, booking)).to_dict()
    return domain_receipts.build_vendor_payment_record(
        booking, pricing_breakdown=pricing_breakdown, client_display_name=client_name
    )


async def _vendor_payout_statement_payload(
    session: AsyncSession, booking: ReceiptBookingRow
) -> dict[str, Any]:
    """Build or return the stored payout statement without pricing when frozen."""
    frozen = domain_receipts.frozen_payload_from_row(booking, "vendor_payout_statement")
    if frozen is not None:
        return domain_receipts.overlay_live_payment_status(frozen, booking)
    client_names = await identity.client_display_names(session, [booking.client_user_id])
    client_name = client_names.get(booking.client_user_id, "Client")
    pricing_breakdown = (await service_pricing.current_breakdown(session, booking)).to_dict()
    return domain_receipts.build_vendor_payout_statement(
        booking, pricing_breakdown=pricing_breakdown, client_display_name=client_name
    )


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
    return await _client_receipt_payload(session, booking)


async def vendor_payment_record(
    session: AsyncSession,
    *,
    vendor_user_id: str,
    booking_id: str,
) -> dict[str, Any]:
    """The vendor's payment record JSON payload."""
    booking = await _booking_for_vendor(session, vendor_user_id=vendor_user_id, booking_id=booking_id)
    return await _vendor_payment_record_payload(session, booking)


async def vendor_payout_statement(
    session: AsyncSession,
    *,
    vendor_user_id: str,
    booking_id: str,
) -> dict[str, Any]:
    """The vendor's payout statement JSON payload."""
    booking = await _booking_for_vendor(session, vendor_user_id=vendor_user_id, booking_id=booking_id)
    return await _vendor_payout_statement_payload(session, booking)


def render_receipt_html(payload: dict[str, Any]) -> str:
    """HTML for a receipt document, byte-for-byte like the baseline renderer."""
    from app.features.notifications import service as notifications_service

    context: dict[str, object] = {
        **domain_receipts.receipt_email_context(payload),
        **notifications_service.receipt_document_branding(),
    }
    return notifications_service.render_receipt_document_html(context)


async def freeze_after_checkout(session: AsyncSession, mailer: Mailer, booking_id: str) -> None:
    """Write-once client and vendor payment documents, then email both parties (baseline checkout hook)."""
    async with repository_receipts.receipt_freeze_savepoint(session):
        booking = await repository_receipts.get_booking_for_receipt(session, booking_id)
        if booking is None:
            return
        vendor_names = await service_listing.display_names(session, [booking.vendor_user_id])
        vendor_name = vendor_names.get(booking.vendor_user_id, _UNKNOWN_VENDOR_NAME)
        client_names = await identity.client_display_names(session, [booking.client_user_id])
        client_name = client_names.get(booking.client_user_id, "Client")
        pricing_breakdown = (await service_pricing.current_breakdown(session, booking)).to_dict()
        client_snapshot = domain_receipts.build_client_payment_receipt(
            booking, pricing_breakdown=pricing_breakdown, vendor_display_name=vendor_name
        )
        vendor_snapshot = domain_receipts.build_vendor_payment_record(
            booking, pricing_breakdown=pricing_breakdown, client_display_name=client_name
        )
        await repository_receipts.freeze_receipt_snapshots(
            session,
            booking_id,
            client_snapshot=client_snapshot,
            vendor_record_snapshot=vendor_snapshot,
        )
        for user_id, payload in (
            (booking.client_user_id, client_snapshot),
            (booking.vendor_user_id, vendor_snapshot),
        ):
            if not user_id:
                continue
            try:
                await notifications_service.send_receipt_email(
                    session,
                    mailer,
                    user_id=user_id,
                    booking_id=booking_id,
                    receipt_payload=payload,
                )
            except Exception:
                log.warning(
                    "bookings: payment receipt email failed booking=%s user=%s",
                    booking_id,
                    user_id,
                    exc_info=True,
                )


async def freeze_after_payout(session: AsyncSession, mailer: Mailer, booking_id: str) -> None:
    """Write-once payout statement and email the vendor (baseline payout release hook)."""
    async with repository_receipts.receipt_freeze_savepoint(session):
        booking = await repository_receipts.get_booking_for_receipt(session, booking_id)
        if booking is None:
            return
        client_names = await identity.client_display_names(session, [booking.client_user_id])
        client_name = client_names.get(booking.client_user_id, "Client")
        pricing_breakdown = (await service_pricing.current_breakdown(session, booking)).to_dict()
        statement = domain_receipts.build_vendor_payout_statement(
            booking, pricing_breakdown=pricing_breakdown, client_display_name=client_name
        )
        await repository_receipts.freeze_payout_statement_snapshot(
            session, booking_id, statement_snapshot=statement
        )
        if not booking.vendor_user_id:
            return
        try:
            await notifications_service.send_receipt_email(
                session,
                mailer,
                user_id=booking.vendor_user_id,
                booking_id=booking_id,
                receipt_payload=statement,
            )
        except Exception:
            log.warning(
                "bookings: payout statement email failed booking=%s vendor=%s",
                booking_id,
                booking.vendor_user_id,
                exc_info=True,
            )
