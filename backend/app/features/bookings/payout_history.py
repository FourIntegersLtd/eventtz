"""Vendor payout ledger: what Eventtz has sent a vendor, and what is still coming.

Vendors see their **own earnings** here - never `total_label`, which is the client
total including the Eventtz service fee the vendor never receives.

Rows are payouts, not receipts: a booking only appears once its payment has been
collected, either `paid` (Transfer still to come) or `payout_released` (Transfer sent).
A checkout that is merely `pending` is money Eventtz has not received, let alone paid on.
"""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.auth.lookup import client_display_names_by_id
from app.features.bookings.pricing import build_pricing_breakdown, format_gbp

logger = get_logger(__name__)

PAYOUT_PAYMENT_STATUSES = ("paid", "payout_released")

_PAYOUT_COLS = (
    "id,event_name,event_date,client_user_id,created_at,paid_at,payment_status,"
    "vendor_amount_gbp,payout_released_at,line_items,vendor_adjustments"
)


def vendor_amount_for_row(row: dict[str, Any]) -> float:
    """The vendor's share: the snapshot taken at payment, or live pricing for older rows."""
    raw = row.get("vendor_amount_gbp")
    if raw is not None:
        try:
            return round(float(raw), 2)
        except (TypeError, ValueError):
            logger.warning(
                "payout ledger: unusable vendor_amount_gbp=%r booking=%s",
                raw,
                row.get("id"),
            )
    line_items = row.get("line_items")
    pb = build_pricing_breakdown(
        line_items=line_items if isinstance(line_items, list) else [],
        vendor_adjustments=row.get("vendor_adjustments"),
    )
    return float(pb["vendor_portion_gbp"])


def _payout_sort_key(row: dict[str, Any]) -> str:
    return str(row.get("payout_released_at") or row.get("paid_at") or row.get("created_at") or "")


def _empty_ledger() -> dict[str, Any]:
    return {
        "payouts": [],
        "total_paid_out_gbp": 0.0,
        "total_paid_out_label": format_gbp(0.0),
        "total_awaiting_gbp": 0.0,
        "total_awaiting_label": format_gbp(0.0),
    }


def list_vendor_payouts(vendor_user_id: str) -> dict[str, Any]:
    """Payout rows, newest first, plus paid-out and awaiting totals."""
    if get_settings().local_auth_mode:
        return _empty_ledger()

    res = (
        get_client()
        .table("booking_requests")
        .select(_PAYOUT_COLS)
        .eq("vendor_user_id", vendor_user_id)
        .in_("payment_status", list(PAYOUT_PAYMENT_STATUSES))
        .execute()
    )
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    rows.sort(key=_payout_sort_key, reverse=True)

    names = client_display_names_by_id(
        [str(r["client_user_id"]) for r in rows if r.get("client_user_id")],
    )

    payouts: list[dict[str, Any]] = []
    paid_out_total = 0.0
    awaiting_total = 0.0
    for row in rows:
        released = str(row.get("payment_status") or "") == "payout_released"
        amount = vendor_amount_for_row(row)
        if released:
            paid_out_total += amount
        else:
            awaiting_total += amount
        event_date = str(row.get("event_date") or "")[:10]
        payouts.append(
            {
                "booking_id": str(row.get("id") or ""),
                "event_name": str(row.get("event_name") or ""),
                "event_date": event_date or None,
                "client_display_name": names.get(str(row.get("client_user_id") or "")),
                "amount_gbp": amount,
                "amount_label": format_gbp(amount),
                "status": "paid_out" if released else "awaiting_payout",
                "paid_out_at": row.get("payout_released_at") if released else None,
            },
        )

    paid_out_total = round(paid_out_total, 2)
    awaiting_total = round(awaiting_total, 2)
    return {
        "payouts": payouts,
        "total_paid_out_gbp": paid_out_total,
        "total_paid_out_label": format_gbp(paid_out_total),
        "total_awaiting_gbp": awaiting_total,
        "total_awaiting_label": format_gbp(awaiting_total),
    }
