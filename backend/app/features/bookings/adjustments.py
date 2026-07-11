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
from app.features.bookings.pricing import build_pricing_breakdown, persisted_booking_total_label
from app.features.notifications.service import upsert_booking_notification


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
        .select("id,status,line_items,client_user_id,initiator")
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

    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=stored)
    if float(pb.get("vendor_portion_gbp") or 0) < 0:
        raise ValueError(
            "Discounts cannot exceed the quoted line items plus any other adjustments.",
        )
    total_label = persisted_booking_total_label(pb)
    adj_final = pb.get("vendor_adjustments") or []

    upd = (
        client.table("booking_requests")
        .update({"vendor_adjustments": adj_final, "total_label": total_label})
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
            lead_sentence="The vendor updated costs on your request.",
            total_label=ttl,
            adjustments=list(adj_final),
        )
        upsert_booking_notification(
            user_id=client_uid,
            booking_id=booking_id,
            kind="booking_pricing_updated",
            body=body,
        )
    _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
    return get_booking_request_for_vendor(vendor_user_id, booking_id)
