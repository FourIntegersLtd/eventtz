"""Pricing breakdown for booking requests (vendor quote + adjustments + platform fee)."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings


def _fmt_gbp(amount: float) -> str:
    if amount != amount:  # NaN
        return "GBP 0.00"
    s = f"{amount:.2f}"
    if s.endswith(".00"):
        s = str(int(round(amount)))
    return f"GBP {s}"


def sum_line_items_gbp(line_items: list[dict[str, Any]] | Any) -> tuple[float, bool]:
    """Sum numeric line item prices; has_tbc True if any line has null price."""
    if not isinstance(line_items, list):
        return 0.0, False
    total = 0.0
    has_tbc = False
    for li in line_items:
        if not isinstance(li, dict):
            continue
        v = li.get("unit_price_gbp")
        if v is None:
            has_tbc = True
        else:
            try:
                total += float(v)
            except (TypeError, ValueError):
                has_tbc = True
    return total, has_tbc


def sum_adjustments_gbp(adjustments: list[dict[str, Any]] | Any) -> float:
    if not isinstance(adjustments, list):
        return 0.0
    total = 0.0
    for a in adjustments:
        if not isinstance(a, dict):
            continue
        raw = a.get("amount_gbp")
        try:
            n = float(raw)
        except (TypeError, ValueError):
            continue
        if -1e9 < n < 1e9:
            total += n
    return total


def normalize_vendor_adjustments_stored(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for a in raw:
        if not isinstance(a, dict):
            continue
        aid = str(a.get("id") or "").strip()
        tag = str(a.get("tag") or "other").strip()[:50] or "other"
        label = str(a.get("label") or "Additional cost").strip()[:200] or "Additional cost"
        try:
            amt = float(a.get("amount_gbp"))
        except (TypeError, ValueError):
            continue
        if amt == 0 or amt <= -1e9 or amt >= 1e9:
            continue
        out.append(
            {
                "id": aid if len(aid) >= 8 else str(uuid.uuid4()),
                "tag": tag,
                "label": label,
                "amount_gbp": round(amt, 2),
            },
        )
    return out[:20]


def build_pricing_breakdown(
    *,
    line_items: list[dict[str, Any]] | Any,
    vendor_adjustments: list[dict[str, Any]] | Any,
    service_fee_percent: float | None = None,
) -> dict[str, Any]:
    """
    vendor_portion = sum(line items) + sum(adjustments). Adjustments may be negative (discounts).
    service_fee = fee_base * (fee_percent/100) where fee_base is line items plus any discounts
    (negative adjustments). Surcharges (positive adjustments) are not included in the fee base.
    client_total = vendor_portion + service_fee (when no TBC in lines).
    """
    pct = service_fee_percent
    if pct is None:
        pct = float(get_settings().booking_service_fee_percent)
    pct = max(0.0, min(100.0, pct))

    li_sum, has_tbc_lines = sum_line_items_gbp(line_items if isinstance(line_items, list) else [])
    adj_list = normalize_vendor_adjustments_stored(vendor_adjustments)
    adj_sum = sum(a["amount_gbp"] for a in adj_list)

    vendor_portion = round(li_sum + adj_sum, 2)
    fee_base = round(max(0.0, li_sum + min(adj_sum, 0)), 2)
    fee = round(fee_base * (pct / 100.0), 2)
    client_total = round(vendor_portion + fee, 2)

    return {
        "line_items_subtotal_gbp": round(li_sum, 2),
        "vendor_adjustments": adj_list,
        "adjustments_total_gbp": round(adj_sum, 2),
        "vendor_portion_gbp": vendor_portion,
        "service_fee_percent": pct,
        "service_fee_gbp": fee,
        "client_total_gbp": client_total,
        "has_pricing_tbc": has_tbc_lines,
        "vendor_portion_label": _fmt_gbp(vendor_portion),
        "service_fee_label": _fmt_gbp(fee),
        "client_total_label": _fmt_gbp(client_total),
        "line_items_subtotal_label": _fmt_gbp(li_sum),
    }


def persisted_booking_total_label(pb: dict[str, Any]) -> str:
    """
    Canonical string for booking_requests.total_label: full client-facing amount
    (vendor portion + Eventtz fee), aligned with build_pricing_breakdown.
    """
    client_l = str(pb.get("client_total_label") or "").strip()
    if pb.get("has_pricing_tbc"):
        li_sum = float(pb.get("line_items_subtotal_gbp") or 0)
        adj_sum = float(pb.get("adjustments_total_gbp") or 0)
        if li_sum == 0 and adj_sum == 0:
            return "TBC"
        return f"{client_l} + TBC" if client_l else "TBC"
    return client_l or "GBP 0"
