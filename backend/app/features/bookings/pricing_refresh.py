"""Recalculate package prices and booking totals from the vendor profile and event date."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.features.vendor_referrals.booking_discount import (
    build_pricing_breakdown_for_booking_row,
    pricing_snapshot_fields,
)
from app.features.bookings import messages as booking_messages
from app.features.vendors.list_pricing import reconcile_automatic_discount_lines


def _parse_event_date(row: dict[str, Any]) -> date:
    raw = row.get("event_date")
    if isinstance(raw, date):
        return raw
    if isinstance(raw, str) and raw.strip():
        return date.fromisoformat(raw.strip()[:10])
    raise ValueError(booking_messages.BOOKING_MISSING_EVENT_DATE)


def refresh_booking_pricing(
    row: dict[str, Any],
    vendor_payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Update automatic discount lines from the vendor profile and event date, then rebuild totals.
    Raises ValueError when pricing is not valid for payment.
    """
    line_items = row.get("line_items")
    if not isinstance(line_items, list):
        line_items = []

    event_date = _parse_event_date(row)
    line_items = reconcile_automatic_discount_lines(line_items, vendor_payload, event_date)

    raw_adj = row.get("vendor_adjustments")
    vendor_adjustments = raw_adj if isinstance(raw_adj, list) else []

    pricing_row = {
        **row,
        "line_items": line_items,
        "vendor_adjustments": vendor_adjustments,
    }
    pb = build_pricing_breakdown_for_booking_row(pricing_row)

    if pb.get("has_pricing_tbc"):
        raise ValueError(booking_messages.PRICES_TO_CONFIRM)

    if float(pb.get("vendor_portion_gbp") or 0) <= 0:
        raise ValueError(booking_messages.NOTHING_TO_PAY)

    return {
        "line_items": line_items,
        **pricing_snapshot_fields(pb),
        "pricing_breakdown": pb,
    }
