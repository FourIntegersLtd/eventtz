"""Build payment receipts and vendor statements from booking payment snapshots."""

from __future__ import annotations

from typing import Any, Literal

from app.core.db import get_db
from app.features.bookings.pricing import format_gbp
from app.features.vendor_referrals.booking_discount import build_pricing_breakdown_for_booking_row
from app.features.email.constants import COMPANY_LEGAL_NAME, EMAIL_SUPPORT_ADDRESS
from app.features.bookings import messages as booking_messages

RECEIPT_ELIGIBLE_STATUSES = frozenset(
    {"paid", "payout_released", "refunded", "partially_refunded"},
)

PAYOUT_STATEMENT_STATUSES = frozenset({"payout_released"})


def _has_frozen_client_receipt(snap: dict[str, Any] | None) -> bool:
    if not snap:
        return False
    frozen = snap.get("payment_receipt_snapshot")
    return isinstance(frozen, dict) and frozen.get("document_type") == "client_payment_receipt"


def verify_client_receipt_with_stripe(snap: dict[str, Any] | None) -> None:
    """Raise HTTPException when Stripe cannot verify an unfrozen client receipt."""
    from fastapi import HTTPException

    from app.features.payments.stripe import ReceiptVerificationError, verify_payment_for_receipt

    if not snap:
        return
    has_frozen = _has_frozen_client_receipt(snap)
    pi_id = str(snap.get("stripe_payment_intent_id") or "").strip()
    if not pi_id.startswith("pi_"):
        if has_frozen:
            return
        raise HTTPException(
            status_code=404,
            detail=booking_messages.RECEIPT_STRIPE_VERIFY_FAILED,
        )
    try:
        raw_amount = snap.get("payment_amount_gbp")
        expected = float(raw_amount) if raw_amount is not None else None
    except (TypeError, ValueError):
        expected = None
    try:
        verify_payment_for_receipt(
            payment_intent_id=pi_id,
            expected_amount_gbp=expected,
        )
    except ReceiptVerificationError as e:
        if has_frozen and e.status_code == 503:
            return
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e


def receipt_number(booking_id: str) -> str:
    raw = str(booking_id or "").replace("-", "").upper()
    return f"EVT-{raw[:8]}" if raw else "EVT-UNKNOWN"


def _payment_reference(charge_id: str | None) -> str | None:
    cid = str(charge_id or "").strip()
    if not cid:
        return None
    tail = cid[-8:].upper()
    return f"…{tail}" if len(cid) > 8 else tail


def _transfer_reference(transfer_id: str | None) -> str | None:
    tid = str(transfer_id or "").strip()
    if not tid:
        return None
    tail = tid[-8:].upper()
    return f"…{tail}" if len(tid) > 8 else tail


def _line_item_label(li: dict[str, Any]) -> str:
    heading = ""
    for key in ("heading", "label", "name"):
        v = li.get(key)
        if isinstance(v, str) and v.strip():
            heading = v.strip()[:200]
            break
    if not heading:
        heading = "Item"
    qty = li.get("quantity")
    rate = li.get("unit_rate_gbp")
    unit_label = li.get("unit_label")
    try:
        qty_n = int(qty) if qty is not None else None
    except (TypeError, ValueError):
        qty_n = None
    try:
        rate_n = float(rate) if rate is not None else None
    except (TypeError, ValueError):
        rate_n = None
    if qty_n and qty_n > 0 and rate_n is not None:
        unit = str(unit_label).strip() if isinstance(unit_label, str) else ""
        unit_bit = f" / {unit}" if unit else ""
        return f"{heading} × {qty_n} @ {format_gbp(rate_n)}{unit_bit}"[:200]
    return heading


def _build_receipt_lines(
    *,
    row: dict[str, Any],
    pb: dict[str, Any],
    include_service_fee: bool,
) -> list[dict[str, str]]:
    lines: list[dict[str, str]] = []
    line_items = row.get("line_items")
    if isinstance(line_items, list):
        for li in line_items:
            if not isinstance(li, dict):
                continue
            price = li.get("unit_price_gbp")
            if price is None:
                lines.append({"label": _line_item_label(li), "amount_label": "TBC"})
                continue
            try:
                amt = float(price)
            except (TypeError, ValueError):
                lines.append({"label": _line_item_label(li), "amount_label": "TBC"})
                continue
            lines.append(
                {
                    "label": _line_item_label(li),
                    "amount_label": format_gbp(amt),
                },
            )

    for adj in pb.get("vendor_adjustments") or []:
        if not isinstance(adj, dict):
            continue
        label = str(adj.get("label") or "Adjustment").strip() or "Adjustment"
        try:
            amt = float(adj.get("amount_gbp"))
        except (TypeError, ValueError):
            continue
        lines.append({"label": label, "amount_label": format_gbp(amt)})

    if include_service_fee:
        fee_before = pb.get("service_fee_before_discount_gbp")
        referral_discount = pb.get("referral_fee_discount_gbp")
        fee = pb.get("service_fee_gbp")
        pct = pb.get("service_fee_percent")
        if fee is not None:
            try:
                fee_f = float(fee)
                pct_f = float(pct) if pct is not None else None
                fee_label = (
                    f"Eventtz service fee ({pct_f:g}%)"
                    if pct_f is not None
                    else "Eventtz service fee"
                )
                if referral_discount and float(referral_discount) > 0 and fee_before is not None:
                    lines.append(
                        {
                            "label": fee_label,
                            "amount_label": format_gbp(float(fee_before)),
                        },
                    )
                    lines.append(
                        {
                            "label": "Referral discount",
                            "amount_label": format_gbp(-float(referral_discount)),
                        },
                    )
                    lines.append(
                        {
                            "label": "Eventtz fee due",
                            "amount_label": format_gbp(fee_f),
                        },
                    )
                else:
                    lines.append({"label": fee_label, "amount_label": format_gbp(fee_f)})
            except (TypeError, ValueError):
                pass

    return lines


def _status_note(payment_status: str) -> str | None:
    if payment_status == "refunded":
        return "This payment was refunded in full."
    if payment_status == "partially_refunded":
        return "This payment was partially refunded."
    return None


def _snapshot_amount(row: dict[str, Any], key: str, fallback_pb_key: str | None, pb: dict[str, Any]) -> float | None:
    raw = row.get(key)
    if raw is not None:
        try:
            return float(raw)
        except (TypeError, ValueError):
            pass
    if fallback_pb_key and pb.get(fallback_pb_key) is not None:
        try:
            return float(pb[fallback_pb_key])
        except (TypeError, ValueError):
            pass
    return None


def _attach_pricing(row: dict[str, Any]) -> dict[str, Any]:
    return build_pricing_breakdown_for_booking_row(row)


def load_payment_snapshot(booking_id: str) -> dict[str, Any] | None:
    res = (
        get_db()
        .table("booking_requests")
        .select(
            "id,payment_status,paid_at,payout_released_at,payment_amount_gbp,"
            "vendor_amount_gbp,platform_fee_gbp,stripe_charge_id,stripe_transfer_id,"
            "stripe_receipt_url,stripe_payment_intent_id,line_items,vendor_adjustments,"
            "vendor_user_id,vendor_referral_code,service_fee_percent,"
            "payment_receipt_snapshot,vendor_payment_record_snapshot,"
            "vendor_payout_statement_snapshot",
        )
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]


def _frozen_snapshot_column(document_type: str) -> str:
    if document_type == "client_payment_receipt":
        return "payment_receipt_snapshot"
    if document_type == "vendor_payment_record":
        return "vendor_payment_record_snapshot"
    return "vendor_payout_statement_snapshot"


def _frozen_payload_from_row(row: dict[str, Any], document_type: str) -> dict[str, Any] | None:
    col = _frozen_snapshot_column(document_type)
    raw = row.get(col)
    if isinstance(raw, dict) and raw.get("document_type") == document_type:
        return raw
    return None


def _vendor_payment_record_status_note(payment_status: str) -> str | None:
    if payment_status in ("refunded", "partially_refunded"):
        return _status_note(payment_status)
    if payment_status == "payout_released":
        return (
            "Client payment received. Your share has been released to your connected Stripe account."
        )
    if payment_status == "paid":
        return (
            "Client payment received. Your share is held safely with Eventtz until the event "
            "is complete and both sides confirm — or the automatic release date passes."
        )
    return None


def _overlay_live_payment_status(
    payload: dict[str, Any],
    snap: dict[str, Any],
) -> dict[str, Any]:
    """Keep frozen line items; refresh payment_status and status_note from live booking."""
    out = dict(payload)
    status = str(snap.get("payment_status") or out.get("payment_status") or "paid")
    out["payment_status"] = status
    doc_type = str(out.get("document_type") or "")
    if doc_type == "vendor_payment_record":
        out["status_note"] = _vendor_payment_record_status_note(status)
    elif doc_type == "client_payment_receipt":
        out["status_note"] = _status_note(status)
    elif doc_type == "vendor_payout_statement":
        out["status_note"] = out.get("status_note") or (
            "Payout sent to your connected Stripe account. Bank arrival times depend on your bank."
        )
    if doc_type in ("vendor_payment_record", "vendor_payout_statement"):
        payout_at = snap.get("payout_released_at")
        if isinstance(payout_at, str) and payout_at:
            out["payout_released_at"] = payout_at
    elif doc_type == "client_payment_receipt":
        out["payout_released_at"] = None
    return out


def _payload_from_frozen_or_build(
    *,
    document_type: str,
    row: dict[str, Any],
    snap: dict[str, Any] | None,
    build_fn,
) -> dict[str, Any]:
    merged_row = {**row, **(snap or {})}
    frozen = _frozen_payload_from_row(merged_row, document_type)
    if frozen is not None:
        return _overlay_live_payment_status(frozen, merged_row)
    return build_fn()


def _require_eligible(row: dict[str, Any], *, allowed: frozenset[str]) -> str:
    status = str(row.get("payment_status") or "unpaid")
    if status not in allowed:
        raise ValueError(booking_messages.RECEIPT_NOT_AVAILABLE)
    return status


def build_client_payment_receipt(
    row: dict[str, Any],
    *,
    vendor_display_name: str,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    snap = snapshot or row

    def _build_live() -> dict[str, Any]:
        payment_status = _require_eligible(snap, allowed=RECEIPT_ELIGIBLE_STATUSES)
        pb = _attach_pricing(row)
        booking_id = str(row.get("id") or row.get("booking_request_id") or "")
        payment_amount = _snapshot_amount(snap, "payment_amount_gbp", "client_total_gbp", pb)
        total_label = (
            format_gbp(payment_amount) if payment_amount is not None else str(pb.get("client_total_label") or "")
        )
        return {
            "document_type": "client_payment_receipt",
            "receipt_number": receipt_number(booking_id),
            "booking_request_id": booking_id,
            "event_name": str(row.get("event_name") or ""),
            "event_date": str(row.get("event_date") or "")[:10],
            "payment_status": payment_status,
            "paid_at": snap.get("paid_at") if isinstance(snap.get("paid_at"), str) else None,
            "payout_released_at": None,
            "counterparty_name": vendor_display_name,
            "line_items": _build_receipt_lines(row=row, pb=pb, include_service_fee=True),
            "subtotal_label": str(pb.get("vendor_portion_label") or ""),
            "service_fee_label": str(pb.get("service_fee_label") or ""),
            "service_fee_percent": float(pb["service_fee_percent"])
            if pb.get("service_fee_percent") is not None
            else None,
            "total_label": total_label,
            "vendor_share_label": None,
            "platform_fee_label": None,
            "payment_reference": _payment_reference(snap.get("stripe_charge_id")),
            "transfer_reference": None,
            "stripe_receipt_url": str(snap.get("stripe_receipt_url") or "").strip() or None,
            "status_note": _status_note(payment_status),
            "stripe_payment_intent_id": str(snap.get("stripe_payment_intent_id") or "").strip() or None,
            "payment_amount_gbp": payment_amount,
        }

    return _payload_from_frozen_or_build(
        document_type="client_payment_receipt",
        row=row,
        snap=snap,
        build_fn=_build_live,
    )


def build_vendor_payment_record(
    row: dict[str, Any],
    *,
    client_display_name: str,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    snap = snapshot or row

    def _build_live() -> dict[str, Any]:
        payment_status = _require_eligible(snap, allowed=RECEIPT_ELIGIBLE_STATUSES)
        pb = _attach_pricing(row)
        booking_id = str(row.get("id") or row.get("booking_request_id") or "")
        vendor_amount = _snapshot_amount(snap, "vendor_amount_gbp", "vendor_portion_gbp", pb)
        platform_fee = _snapshot_amount(snap, "platform_fee_gbp", "service_fee_gbp", pb)
        lines = _build_receipt_lines(row=row, pb=pb, include_service_fee=False)
        if vendor_amount is not None:
            total_label = format_gbp(vendor_amount)
        else:
            total_label = str(pb.get("vendor_portion_label") or "")
        return {
            "document_type": "vendor_payment_record",
            "receipt_number": receipt_number(booking_id),
            "booking_request_id": booking_id,
            "event_name": str(row.get("event_name") or ""),
            "event_date": str(row.get("event_date") or "")[:10],
            "payment_status": payment_status,
            "paid_at": snap.get("paid_at") if isinstance(snap.get("paid_at"), str) else None,
            "payout_released_at": None,
            "counterparty_name": client_display_name or "Client",
            "line_items": lines,
            "subtotal_label": str(pb.get("vendor_portion_label") or ""),
            "service_fee_label": None,
            "service_fee_percent": None,
            "total_label": total_label,
            "vendor_share_label": total_label,
            "platform_fee_label": format_gbp(platform_fee)
            if platform_fee is not None
            else str(pb.get("service_fee_label") or ""),
            "payment_reference": _payment_reference(snap.get("stripe_charge_id")),
            "transfer_reference": None,
            "stripe_receipt_url": None,
            "status_note": _vendor_payment_record_status_note(payment_status),
        }

    return _payload_from_frozen_or_build(
        document_type="vendor_payment_record",
        row=row,
        snap=snap,
        build_fn=_build_live,
    )


def build_vendor_payout_statement(
    row: dict[str, Any],
    *,
    client_display_name: str,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    snap = snapshot or row

    def _build_live() -> dict[str, Any]:
        payment_status = _require_eligible(snap, allowed=PAYOUT_STATEMENT_STATUSES)
        pb = _attach_pricing(row)
        booking_id = str(row.get("id") or row.get("booking_request_id") or "")
        vendor_amount = _snapshot_amount(snap, "vendor_amount_gbp", "vendor_portion_gbp", pb)
        total_label = (
            format_gbp(vendor_amount) if vendor_amount is not None else str(pb.get("vendor_portion_label") or "")
        )
        payout_at = snap.get("payout_released_at")
        payout_at_str = payout_at if isinstance(payout_at, str) else None
        return {
            "document_type": "vendor_payout_statement",
            "receipt_number": receipt_number(booking_id),
            "booking_request_id": booking_id,
            "event_name": str(row.get("event_name") or ""),
            "event_date": str(row.get("event_date") or "")[:10],
            "payment_status": payment_status,
            "paid_at": snap.get("paid_at") if isinstance(snap.get("paid_at"), str) else None,
            "payout_released_at": payout_at_str,
            "counterparty_name": client_display_name or "Client",
            "line_items": [{"label": "Vendor share", "amount_label": total_label}],
            "subtotal_label": None,
            "service_fee_label": None,
            "service_fee_percent": None,
            "total_label": total_label,
            "vendor_share_label": total_label,
            "platform_fee_label": None,
            "payment_reference": _payment_reference(snap.get("stripe_charge_id")),
            "transfer_reference": _transfer_reference(snap.get("stripe_transfer_id")),
            "stripe_receipt_url": None,
            "status_note": (
                "Payout sent to your connected Stripe account. Bank arrival times depend on your bank."
            ),
        }

    return _payload_from_frozen_or_build(
        document_type="vendor_payout_statement",
        row=row,
        snap=snap,
        build_fn=_build_live,
    )


def receipt_context_for_email(payload: dict[str, Any]) -> dict[str, Any]:
    doc_type = str(payload.get("document_type") or "")
    if doc_type == "client_payment_receipt":
        headline = "Your payment receipt"
        subtitle = f"Receipt {payload.get('receipt_number', '')}"
    elif doc_type == "vendor_payment_record":
        headline = "Payment received"
        subtitle = f"Record {payload.get('receipt_number', '')}"
    else:
        headline = "Payout statement"
        subtitle = f"Statement {payload.get('receipt_number', '')}"

    return {
        "headline": headline,
        "subtitle": subtitle,
        "receipt": payload,
        "company_legal_name": COMPANY_LEGAL_NAME,
        "support_email": EMAIL_SUPPORT_ADDRESS,
    }


def persist_payment_receipt_snapshots(booking_id: str) -> None:
    """Write-once frozen receipt payloads at payment time."""
    from app.features.auth.user_vendor_display_lookup import (
        client_display_names_by_id,
        vendor_display_names_by_id,
    )
    from app.features.bookings.db import get_booking_request_by_id

    row = get_booking_request_by_id(booking_id)
    if not row:
        return

    snap = load_payment_snapshot(booking_id) or row
    updates: dict[str, Any] = {}

    if not isinstance(row.get("payment_receipt_snapshot"), dict):
        vid = str(row.get("vendor_user_id") or "")
        vname = vendor_display_names_by_id([vid]).get(vid, "Vendor")
        updates["payment_receipt_snapshot"] = build_client_payment_receipt(
            row,
            vendor_display_name=vname,
            snapshot=snap,
        )

    if not isinstance(row.get("vendor_payment_record_snapshot"), dict):
        cid = str(row.get("client_user_id") or "")
        cname = client_display_names_by_id([cid]).get(cid, "Client")
        updates["vendor_payment_record_snapshot"] = build_vendor_payment_record(
            row,
            client_display_name=cname,
            snapshot=snap,
        )

    if updates:
        get_db().table("booking_requests").update(updates).eq("id", booking_id).execute()


def persist_vendor_payout_statement_snapshot(booking_id: str) -> None:
    """Write-once frozen payout statement when transfer succeeds."""
    from app.features.auth.user_vendor_display_lookup import client_display_names_by_id
    from app.features.bookings.db import get_booking_request_by_id

    row = get_booking_request_by_id(booking_id)
    if not row or isinstance(row.get("vendor_payout_statement_snapshot"), dict):
        return

    snap = load_payment_snapshot(booking_id) or row
    cid = str(row.get("client_user_id") or "")
    cname = client_display_names_by_id([cid]).get(cid, "Client")
    payload = build_vendor_payout_statement(
        row,
        client_display_name=cname,
        snapshot=snap,
    )
    get_db().table("booking_requests").update(
        {"vendor_payout_statement_snapshot": payload},
    ).eq("id", booking_id).execute()


def dispatch_payment_receipts_after_checkout(
    booking_id: str,
    *,
    client_id: str,
    vendor_id: str,
) -> None:
    """Email client receipt and vendor payment record after successful checkout."""
    from app.features.auth.user_vendor_display_lookup import (
        client_display_names_by_id,
        vendor_display_names_by_id,
    )
    from app.features.bookings.db import get_booking_request_by_id
    from app.features.email.dispatch import dispatch_receipt_email

    row = get_booking_request_by_id(booking_id)
    if not row:
        return
    snap = load_payment_snapshot(booking_id) or row

    if client_id:
        vid = str(row.get("vendor_user_id") or "")
        vname = vendor_display_names_by_id([vid]).get(vid, "Vendor")
        payload = build_client_payment_receipt(
            row,
            vendor_display_name=vname,
            snapshot=snap,
        )
        dispatch_receipt_email(
            user_id=client_id,
            booking_id=booking_id,
            receipt_payload=payload,
        )

    if vendor_id:
        cid = str(row.get("client_user_id") or "")
        cname = client_display_names_by_id([cid]).get(cid, "Client")
        payload = build_vendor_payment_record(
            row,
            client_display_name=cname,
            snapshot=snap,
        )
        dispatch_receipt_email(
            user_id=vendor_id,
            booking_id=booking_id,
            receipt_payload=payload,
        )


def dispatch_vendor_payout_statement_after_release(
    booking_id: str,
    *,
    vendor_id: str,
) -> None:
    from app.features.auth.user_vendor_display_lookup import client_display_names_by_id
    from app.features.bookings.db import get_booking_request_by_id
    from app.features.email.dispatch import dispatch_receipt_email

    row = get_booking_request_by_id(booking_id)
    if not row or not vendor_id:
        return
    snap = load_payment_snapshot(booking_id) or row
    cid = str(row.get("client_user_id") or "")
    cname = client_display_names_by_id([cid]).get(cid, "Client")
    payload = build_vendor_payout_statement(
        row,
        client_display_name=cname,
        snapshot=snap,
    )
    dispatch_receipt_email(
        user_id=vendor_id,
        booking_id=booking_id,
        receipt_payload=payload,
    )
