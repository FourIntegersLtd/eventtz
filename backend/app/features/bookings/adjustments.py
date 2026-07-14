"""Vendor pricing adjustments on pending bookings."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.db import one_row, rows
from app.core.db import get_db as get_client
from app.features.bookings.notifications import (
    _client_booking_pricing_explanation_body,
    _notify_booking_changed,
)
from app.features.bookings.queries import _row_initiator, get_booking_request_for_vendor
from app.features.bookings.pricing import (
    build_pricing_breakdown,
    persisted_booking_total_label,
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
                f"Each surcharge cannot exceed GBP {max_single:,.0f}.",
            )

    if positive_subtotal > 0 and positive_adj > positive_subtotal * (max_pct / 100.0):
        raise ValueError(
            "Total surcharges cannot exceed "
            f"{max_pct:.0f}% of the quoted line items.",
        )


def put_vendor_booking_adjustments(
    vendor_user_id: str,
    booking_id: str,
    adjustments_in: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Replace vendor adjustments while booking is pending (before accept)."""
    if get_settings().local_auth_mode:
        return None

    client = get_client()
    res = (
        client.table("booking_requests")
        .select("id,status,line_items,client_user_id,initiator,initial_client_total_label")
        .eq("id", booking_id)
        .eq("vendor_user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    row0 = one_row(res)
    if row0 is None:
        return None
    if _row_initiator(row0) == "vendor":
        raise ValueError("Adjustments are not editable on vendor quotes before the client accepts.")
    if str(row0.get("status", "")) != "pending":
        raise ValueError("Additional costs can only be edited while the request is pending.")

    line_items = row0.get("line_items")
    if not isinstance(line_items, list):
        line_items = []

    stored: list[dict[str, Any]] = []
    for item in adjustments_in[:20]:
        if not isinstance(item, dict):
            continue
        tag = str(item.get("tag") or "other").strip()[:50] or "other"
        label = str(item.get("label") or "").strip()[:200] or "Additional cost"
        try:
            amt = float(item.get("amount_gbp"))
        except (TypeError, ValueError) as e:
            raise ValueError("Each adjustment needs a valid amount_gbp.") from e
        if amt == 0:
            continue
        if amt < -1_000_000 or amt > 1_000_000:
            raise ValueError("Adjustment amount is out of range.")
        stored.append(
            {
                "id": str(uuid.uuid4()),
                "tag": tag,
                "label": label,
                "amount_gbp": round(amt, 2),
            },
        )

    _validate_adjustment_caps(line_items, stored)

    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=stored)
    if float(pb.get("vendor_portion_gbp") or 0) <= 0:
        raise ValueError(
            "Discounts cannot reduce the booking total to zero or below.",
        )
    total_label = persisted_booking_total_label(pb)
    adj_final = pb.get("vendor_adjustments") or []

    patch: dict[str, Any] = {"vendor_adjustments": adj_final, "total_label": total_label}
    if not str(row0.get("initial_client_total_label") or "").strip():
        pb_initial = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
        patch["initial_client_total_label"] = str(
            pb_initial.get("client_total_label") or persisted_booking_total_label(pb_initial),
        )

    upd = (
        client.table("booking_requests")
        .update(patch)
        .eq("id", booking_id)
        .eq("vendor_user_id", vendor_user_id)
        .eq("status", "pending")
        .execute()
    )
    if not rows(upd):
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
