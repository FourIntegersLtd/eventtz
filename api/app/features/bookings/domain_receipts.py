"""Pure rules for payment receipts, vendor payment records and payout statements.

Mirrors the baseline's `receipts.py`. A frozen snapshot (written once at checkout,
payout release or admin sync in `service_receipts.py`, from the builders below)
always wins over building the document afresh; building afresh happens exactly
once, right when the snapshot is first written.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from typing import Any

from app.features.bookings.errors import ReceiptNotAvailable
from app.features.bookings.rows import ReceiptBookingRow

# Payment states a client receipt / vendor payment record may be read in.
RECEIPT_ELIGIBLE_STATUSES = frozenset({"paid", "payout_released", "refunded", "partially_refunded"})
# A payout statement exists only once the vendor has actually been paid out.
PAYOUT_STATEMENT_STATUSES = frozenset({"payout_released"})

_UNKNOWN_CLIENT_NAME = "Client"


def _format_gbp(amount: float) -> str:
    """Money label matching `pricing.domain.format_gbp` (duplicated: domain cannot import pricing)."""
    if math.isnan(amount):
        return "GBP 0.00"
    text = f"{amount:.2f}"
    if text.endswith(".00"):
        text = str(int(round(amount)))
    return f"GBP {text}"


def receipt_number(booking_id: str) -> str:
    """`EVT-` plus the booking id's first eight hex characters, upper-cased."""
    raw = str(booking_id or "").replace("-", "").upper()
    return f"EVT-{raw[:8]}" if raw else "EVT-UNKNOWN"


def payment_reference(charge_id: str | None) -> str | None:
    """The last 8 characters of the charge id, prefixed with an ellipsis when it was longer."""
    charge = str(charge_id or "").strip()
    if not charge:
        return None
    tail = charge[-8:].upper()
    return f"…{tail}" if len(charge) > 8 else tail


def transfer_reference(transfer_id: str | None) -> str | None:
    """The last 8 characters of the transfer id, prefixed with an ellipsis when it was longer."""
    transfer = str(transfer_id or "").strip()
    if not transfer:
        return None
    tail = transfer[-8:].upper()
    return f"…{tail}" if len(transfer) > 8 else tail


def _line_item_label(line_item: dict[str, Any]) -> str:
    """A quoted line's heading, with quantity and unit rate appended when both are set."""
    heading = ""
    for key in ("heading", "label", "name"):
        value = line_item.get(key)
        if isinstance(value, str) and value.strip():
            heading = value.strip()[:200]
            break
    if not heading:
        heading = "Item"
    quantity = line_item.get("quantity")
    rate = line_item.get("unit_rate_gbp")
    unit_label = line_item.get("unit_label")
    try:
        quantity_n = int(quantity) if quantity is not None else None
    except (TypeError, ValueError):
        quantity_n = None
    try:
        rate_n = float(rate) if rate is not None else None
    except (TypeError, ValueError):
        rate_n = None
    if quantity_n and quantity_n > 0 and rate_n is not None:
        unit = str(unit_label).strip() if isinstance(unit_label, str) else ""
        unit_bit = f" / {unit}" if unit else ""
        return f"{heading} × {quantity_n} @ {_format_gbp(rate_n)}{unit_bit}"[:200]
    return heading


def _receipt_lines(
    *, line_items: list[Any], pricing_breakdown: dict[str, Any], include_service_fee: bool
) -> list[dict[str, str]]:
    """The quoted lines, the vendor's extras/discounts, and (for the client) the service fee line(s)."""
    lines: list[dict[str, str]] = []
    for raw_item in line_items:
        if not isinstance(raw_item, dict):
            continue
        price = raw_item.get("unit_price_gbp")
        if price is None:
            lines.append({"label": _line_item_label(raw_item), "amount_label": "TBC"})
            continue
        try:
            amount = float(price)
        except (TypeError, ValueError):
            lines.append({"label": _line_item_label(raw_item), "amount_label": "TBC"})
            continue
        lines.append({"label": _line_item_label(raw_item), "amount_label": _format_gbp(amount)})

    for adjustment in pricing_breakdown.get("vendor_adjustments") or []:
        if not isinstance(adjustment, dict):
            continue
        label = str(adjustment.get("label") or "Adjustment").strip() or "Adjustment"
        try:
            raw_amount = adjustment.get("amount_gbp")
            amount = float(raw_amount)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        lines.append({"label": label, "amount_label": _format_gbp(amount)})

    if include_service_fee:
        fee = pricing_breakdown.get("service_fee_gbp")
        if fee is not None:
            try:
                fee_f = float(fee)
                percent = pricing_breakdown.get("service_fee_percent")
                percent_f = float(percent) if percent is not None else None
                fee_label = (
                    f"Eventtz service fee ({percent_f:g}%)"
                    if percent_f is not None
                    else "Eventtz service fee"
                )
                discount = pricing_breakdown.get("referral_fee_discount_gbp")
                fee_before = pricing_breakdown.get("service_fee_before_discount_gbp")
                if discount and float(discount) > 0 and fee_before is not None:
                    lines.append({"label": fee_label, "amount_label": _format_gbp(float(fee_before))})
                    lines.append(
                        {"label": "Referral discount", "amount_label": _format_gbp(-float(discount))}
                    )
                    lines.append({"label": "Eventtz fee due", "amount_label": _format_gbp(fee_f)})
                else:
                    lines.append({"label": fee_label, "amount_label": _format_gbp(fee_f)})
            except (TypeError, ValueError):
                pass
    return lines


def _status_note(payment_status: str, booking: ReceiptBookingRow | None = None) -> str | None:
    """The note under a client receipt or payout statement's total, for a refund.

    A tiered client cancel (`domain_cancellation`) says how much came back and why.
    """
    if payment_status == "refunded":
        return "This payment was refunded in full."
    if payment_status == "partially_refunded":
        if booking is not None and booking.cancellation_refund_percent is not None:
            refund_label = _format_gbp(float(booking.cancellation_refund_gbp or 0.0))
            return (
                f"This booking was cancelled by the client. {refund_label} was refunded under the "
                f"vendor's cancellation policy ({booking.cancellation_refund_percent}% of the vendor's "
                "price plus the Eventtz service fee)."
            )
        return "This payment was partially refunded."
    return None


def _vendor_payment_record_status_note(
    payment_status: str, booking: ReceiptBookingRow | None = None
) -> str | None:
    """The note under a vendor payment record's total: refunded, held, or released."""
    if payment_status in ("refunded", "partially_refunded"):
        return _status_note(payment_status, booking)
    if payment_status == "payout_released":
        return "Client payment received. Your share has been released to your connected Stripe account."
    if payment_status == "paid":
        return (
            "Client payment received. Your share is held safely with Eventtz until the event "
            "is complete and both sides confirm — or the automatic release date passes."
        )
    return None


def _amount(
    booking: ReceiptBookingRow,
    column: str,
    fallback_breakdown_key: str | None,
    pricing_breakdown: dict[str, Any],
) -> float | None:
    """The amount stored on the booking row, or the freshly priced equivalent when it is missing."""
    raw = getattr(booking, column, None)
    if raw is not None:
        try:
            return float(raw)
        except (TypeError, ValueError):
            pass
    if fallback_breakdown_key and pricing_breakdown.get(fallback_breakdown_key) is not None:
        try:
            return float(pricing_breakdown[fallback_breakdown_key])
        except (TypeError, ValueError):
            pass
    return None


def require_eligible(payment_status: str, *, allowed: frozenset[str]) -> None:
    """Raise when the payment has not reached a state this document may be read in."""
    if payment_status not in allowed:
        raise ReceiptNotAvailable()


def _deposit_lines(booking: ReceiptBookingRow) -> list[dict[str, str]]:
    """The client's refundable damage deposit, when they paid one (it is part of the total charged)."""
    if not booking.damage_deposit_gbp or booking.damage_deposit_gbp <= 0:
        return []
    return [{"label": "Refundable deposit", "amount_label": _format_gbp(float(booking.damage_deposit_gbp))}]


def build_client_payment_receipt(
    booking: ReceiptBookingRow, *, pricing_breakdown: dict[str, Any], vendor_display_name: str
) -> dict[str, Any]:
    """The client's payment receipt, built fresh from the booking's price today."""
    require_eligible(booking.payment_status, allowed=RECEIPT_ELIGIBLE_STATUSES)
    payment_amount = _amount(booking, "payment_amount_gbp", "client_total_gbp", pricing_breakdown)
    total_label = (
        _format_gbp(payment_amount)
        if payment_amount is not None
        else str(pricing_breakdown.get("client_total_label") or "")
    )
    percent = pricing_breakdown.get("service_fee_percent")
    return {
        "document_type": "client_payment_receipt",
        "receipt_number": receipt_number(booking.id),
        "booking_request_id": booking.id,
        "event_name": booking.event_name or "",
        "event_date": (booking.event_date or "")[:10],
        "payment_status": booking.payment_status,
        "paid_at": booking.paid_at,
        "payout_released_at": None,
        "counterparty_name": vendor_display_name,
        "line_items": _receipt_lines(
            line_items=booking.line_items, pricing_breakdown=pricing_breakdown, include_service_fee=True
        )
        + _deposit_lines(booking),
        "subtotal_label": str(pricing_breakdown.get("vendor_portion_label") or ""),
        "service_fee_label": str(pricing_breakdown.get("service_fee_label") or ""),
        "service_fee_percent": float(percent) if percent is not None else None,
        "total_label": total_label,
        "vendor_share_label": None,
        "platform_fee_label": None,
        "payment_reference": payment_reference(booking.stripe_charge_id),
        "transfer_reference": None,
        "stripe_receipt_url": (booking.stripe_receipt_url or "").strip() or None,
        "status_note": _status_note(booking.payment_status, booking),
        "stripe_payment_intent_id": (booking.stripe_payment_intent_id or "").strip() or None,
        "payment_amount_gbp": payment_amount,
    }


def build_vendor_payment_record(
    booking: ReceiptBookingRow, *, pricing_breakdown: dict[str, Any], client_display_name: str
) -> dict[str, Any]:
    """The vendor's payment record, built fresh from the booking's price today."""
    require_eligible(booking.payment_status, allowed=RECEIPT_ELIGIBLE_STATUSES)
    vendor_amount = _amount(booking, "vendor_amount_gbp", "vendor_portion_gbp", pricing_breakdown)
    platform_fee = _amount(booking, "platform_fee_gbp", "service_fee_gbp", pricing_breakdown)
    total_label = (
        _format_gbp(vendor_amount)
        if vendor_amount is not None
        else str(pricing_breakdown.get("vendor_portion_label") or "")
    )
    return {
        "document_type": "vendor_payment_record",
        "receipt_number": receipt_number(booking.id),
        "booking_request_id": booking.id,
        "event_name": booking.event_name or "",
        "event_date": (booking.event_date or "")[:10],
        "payment_status": booking.payment_status,
        "paid_at": booking.paid_at,
        "payout_released_at": None,
        "counterparty_name": client_display_name or _UNKNOWN_CLIENT_NAME,
        "line_items": _receipt_lines(
            line_items=booking.line_items, pricing_breakdown=pricing_breakdown, include_service_fee=False
        ),
        "subtotal_label": str(pricing_breakdown.get("vendor_portion_label") or ""),
        "service_fee_label": None,
        "service_fee_percent": None,
        "total_label": total_label,
        "vendor_share_label": total_label,
        "platform_fee_label": _format_gbp(platform_fee)
        if platform_fee is not None
        else str(pricing_breakdown.get("service_fee_label") or ""),
        "payment_reference": payment_reference(booking.stripe_charge_id),
        "transfer_reference": None,
        "stripe_receipt_url": None,
        "status_note": _vendor_payment_record_status_note(booking.payment_status, booking),
    }


def build_vendor_payout_statement(
    booking: ReceiptBookingRow, *, pricing_breakdown: dict[str, Any], client_display_name: str
) -> dict[str, Any]:
    """The vendor's payout statement, built fresh once the transfer has been made."""
    require_eligible(booking.payment_status, allowed=PAYOUT_STATEMENT_STATUSES)
    vendor_amount = _amount(booking, "vendor_amount_gbp", "vendor_portion_gbp", pricing_breakdown)
    total_label = (
        _format_gbp(vendor_amount)
        if vendor_amount is not None
        else str(pricing_breakdown.get("vendor_portion_label") or "")
    )
    return {
        "document_type": "vendor_payout_statement",
        "receipt_number": receipt_number(booking.id),
        "booking_request_id": booking.id,
        "event_name": booking.event_name or "",
        "event_date": (booking.event_date or "")[:10],
        "payment_status": booking.payment_status,
        "paid_at": booking.paid_at,
        "payout_released_at": booking.payout_released_at,
        "counterparty_name": client_display_name or _UNKNOWN_CLIENT_NAME,
        "line_items": [{"label": "Vendor share", "amount_label": total_label}],
        "subtotal_label": None,
        "service_fee_label": None,
        "service_fee_percent": None,
        "total_label": total_label,
        "vendor_share_label": total_label,
        "platform_fee_label": None,
        "payment_reference": payment_reference(booking.stripe_charge_id),
        "transfer_reference": transfer_reference(booking.stripe_transfer_id),
        "stripe_receipt_url": None,
        "status_note": (
            "Payout sent to your connected Stripe account. Bank arrival times depend on your bank."
        ),
    }


def frozen_snapshot_column(document_type: str) -> str:
    """Which booking column holds the frozen version of this document type."""
    if document_type == "client_payment_receipt":
        return "payment_receipt_snapshot"
    if document_type == "vendor_payment_record":
        return "vendor_payment_record_snapshot"
    return "vendor_payout_statement_snapshot"


def frozen_payload_from_row(booking: ReceiptBookingRow, document_type: str) -> dict[str, Any] | None:
    """The write-once snapshot for this document type, when payment already stored one."""
    column = frozen_snapshot_column(document_type)
    raw = getattr(booking, column, None)
    if isinstance(raw, dict) and raw.get("document_type") == document_type:
        return raw
    return None


def payload_from_frozen_or_build(
    *,
    booking: ReceiptBookingRow,
    document_type: str,
    build_live: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    """Return a frozen snapshot (with live status overlaid) or build the document afresh once."""
    frozen = frozen_payload_from_row(booking, document_type)
    if frozen is not None:
        return overlay_live_payment_status(frozen, booking)
    return build_live()


def overlay_live_payment_status(payload: dict[str, Any], booking: ReceiptBookingRow) -> dict[str, Any]:
    """Keep a frozen document's line items, but refresh its status note from the booking today.

    A frozen document is written once, at payment (or payout) time; a later refund
    must still show up on it without rebuilding the whole thing.
    """
    out = dict(payload)
    status = booking.payment_status or str(out.get("payment_status") or "paid")
    out["payment_status"] = status
    document_type = str(out.get("document_type") or "")
    if document_type == "vendor_payment_record":
        out["status_note"] = _vendor_payment_record_status_note(status, booking)
    elif document_type == "client_payment_receipt":
        out["status_note"] = _status_note(status, booking)
    elif document_type == "vendor_payout_statement":
        out["status_note"] = out.get("status_note") or (
            "Payout sent to your connected Stripe account. Bank arrival times depend on your bank."
        )
    if document_type in ("vendor_payment_record", "vendor_payout_statement"):
        if booking.payout_released_at:
            out["payout_released_at"] = booking.payout_released_at
    elif document_type == "client_payment_receipt":
        out["payout_released_at"] = None
    return out


def receipt_email_context(payload: dict[str, Any]) -> dict[str, Any]:
    """The headline and subtitle the receipt email and HTML document templates show."""
    document_type = str(payload.get("document_type") or "")
    if document_type == "client_payment_receipt":
        headline, subtitle = "Your payment receipt", f"Receipt {payload.get('receipt_number', '')}"
    elif document_type == "vendor_payment_record":
        headline, subtitle = "Payment received", f"Record {payload.get('receipt_number', '')}"
    else:
        headline, subtitle = "Payout statement", f"Statement {payload.get('receipt_number', '')}"
    return {"headline": headline, "subtitle": subtitle, "receipt": payload}
