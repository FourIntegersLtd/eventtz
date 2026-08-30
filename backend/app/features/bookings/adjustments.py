"""Let vendors add extras or discounts on a booking before it is accepted."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.db import first_row_from_query_result, rows_from_query_result
from app.core.db import get_db
from app.features.bookings import messages as booking_messages
from app.features.bookings.notifications import (
    _client_booking_pricing_explanation_body,
    _notify_booking_changed,
)
from app.features.bookings.queries import _row_initiator, get_booking_request_for_vendor
from app.features.bookings.pricing import persisted_booking_total_label
from app.features.vendor_referrals.booking_discount import (
    build_initial_pricing_breakdown_for_booking_row,
    build_pricing_breakdown_for_booking_row,
)
from app.features.email.dispatch import dispatch_booking_notification


def _validate_adjustment_caps(
    line_items: list[dict[str, Any]],
    stored: list[dict[str, Any]],
) -> None:
    settings = get_settings()
    max_single = float(settings.booking_max_adjustment_gbp)
    max_pct = float(settings.booking_max_adjustment_pct_of_subtotal)

    positive_subtotal = 0.0
    for li in line_items:
        if not isinstance(li, dict):
            continue
        try:
            v = float(li.get("unit_price_gbp") or 0)
        except (TypeError, ValueError):
            continue
        if v > 0:
            positive_subtotal += v
    positive_adj = sum(a["amount_gbp"] for a in stored if a["amount_gbp"] > 0)

    for a in stored:
        amt = a["amount_gbp"]
        if amt > 0 and amt > max_single:
            raise ValueError(
                booking_messages.surcharge_max_detail(max_single),
            )

    if positive_subtotal > 0 and positive_adj > positive_subtotal * (max_pct / 100.0):
        raise ValueError(
            booking_messages.surcharges_pct_detail(max_pct),
        )


def put_vendor_booking_adjustments(
    vendor_user_id: str,
    booking_id: str,
    adjustments_in: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Replace the vendor's extra costs and discounts while the booking is still pending."""
    client = get_db()
    res = (
        client.table("booking_requests")
        .select(
            "id,status,line_items,client_user_id,vendor_user_id,vendor_referral_code,initiator,initial_client_total_label,service_fee_percent",
        )
        .eq("id", booking_id)
        .eq("vendor_user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    row0 = first_row_from_query_result(res)
    if row0 is None:
        return None
    if _row_initiator(row0) == "vendor":
        raise ValueError(booking_messages.ADJUSTMENTS_NOT_ON_VENDOR_QUOTE)
    if str(row0.get("status", "")) != "pending":
        raise ValueError(booking_messages.ADDITIONAL_COSTS_PENDING_ONLY)

    line_items = row0.get("line_items")
    if not isinstance(line_items, list):
        line_items = []

    stored: list[dict[str, Any]] = []
    for item in adjustments_in[:20]:
        if not isinstance(item, dict):
            continue
        tag = str(
            item.get("adjustment_category") or item.get("tag") or "other",
        ).strip()[:50] or "other"
        label = str(item.get("label") or "").strip()[:200] or "Additional cost"
        try:
            amt = float(item.get("amount_gbp"))
        except (TypeError, ValueError) as e:
            raise ValueError(booking_messages.ADJUSTMENT_VALID_AMOUNT) from e
        if amt == 0:
            continue
        if amt < -1_000_000 or amt > 1_000_000:
            raise ValueError(booking_messages.ADJUSTMENT_OUT_OF_RANGE)
        stored.append(
            {
                "id": str(uuid.uuid4()),
                "tag": tag,
                "label": label,
                "amount_gbp": round(amt, 2),
            },
        )

    _validate_adjustment_caps(line_items, stored)

    pricing_row = {**row0, "vendor_adjustments": stored}
    pb = build_pricing_breakdown_for_booking_row(pricing_row)
    if float(pb.get("vendor_portion_gbp") or 0) <= 0:
        raise ValueError(
            booking_messages.DISCOUNTS_TOO_HIGH,
        )
    total_label = persisted_booking_total_label(pb)
    adj_final = pb.get("vendor_adjustments") or []

    patch: dict[str, Any] = {"vendor_adjustments": adj_final, "total_label": total_label}
    if not str(row0.get("initial_client_total_label") or "").strip():
        patch["initial_client_total_label"] = persisted_booking_total_label(
            build_initial_pricing_breakdown_for_booking_row(row0),
        )

    upd = (
        client.table("booking_requests")
        .update(patch)
        .eq("id", booking_id)
        .eq("vendor_user_id", vendor_user_id)
        .eq("status", "pending")
        .execute()
    )
    if not rows_from_query_result(upd):
        return None
    client_uid = str(row0.get("client_user_id") or "")
    if client_uid:
        ttl = str(pb.get("client_total_label") or total_label)
        body = _client_booking_pricing_explanation_body(
            lead_sentence="Your vendor sent an updated price for this booking.",
            total_label=ttl,
            adjustments=list(adj_final),
        )
        dispatch_booking_notification(
            user_id=client_uid,
            booking_id=booking_id,
            kind="booking_pricing_updated",
            body=body,
        )
    _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
    return get_booking_request_for_vendor(vendor_user_id, booking_id)
