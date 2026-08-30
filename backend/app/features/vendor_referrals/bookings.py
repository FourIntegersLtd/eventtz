"""List bookings attributed to a vendor's client referral code."""

from __future__ import annotations

from typing import Any

from app.core.db import apply_recent_first_order, get_db
from app.features.auth.user_vendor_display_lookup import client_display_names_by_id
from app.features.vendor_referrals.booking_discount import build_pricing_breakdown_for_booking_row
from app.features.vendor_referrals.codes import get_vendor_referral_code

_PAID_STATUSES = frozenset({"paid", "payout_released", "refunded", "partially_refunded"})


def list_vendor_referral_bookings(vendor_user_id: str) -> dict[str, Any]:
    uid = str(vendor_user_id or "").strip()
    code = get_vendor_referral_code(uid)
    if not code:
        return {
            "total_referral_bookings": 0,
            "total_fee_savings_gbp": 0.0,
            "bookings": [],
        }

    res = (
        apply_recent_first_order(
            get_db()
            .table("booking_requests")
            .select(
                "id,status,payment_status,event_name,event_date,created_at,"
                "client_user_id,vendor_user_id,line_items,vendor_adjustments,"
                "vendor_referral_code,service_fee_percent,referral_fee_discount_gbp",
            )
            .eq("vendor_user_id", uid)
            .eq("vendor_referral_code", code),
        )
        .limit(200)
        .execute()
    )
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    cids = [str(r["client_user_id"]) for r in rows if r.get("client_user_id")]
    names = client_display_names_by_id(cids)

    bookings: list[dict[str, Any]] = []
    total_savings = 0.0
    for row in rows:
        pb = build_pricing_breakdown_for_booking_row(row)
        vendor_portion = float(pb.get("vendor_portion_gbp") or 0)
        payment_status = str(row.get("payment_status") or "unpaid")
        paid_discount = row.get("referral_fee_discount_gbp")
        if payment_status in _PAID_STATUSES and paid_discount is not None:
            try:
                discount = float(paid_discount)
            except (TypeError, ValueError):
                discount = float(pb.get("referral_fee_discount_gbp") or 0)
        else:
            discount = float(pb.get("referral_fee_discount_gbp") or 0)

        total_savings += discount
        cid = str(row.get("client_user_id") or "")
        bookings.append(
            {
                "booking_request_id": str(row.get("id") or ""),
                "event_name": str(row.get("event_name") or ""),
                "event_date": str(row.get("event_date") or "")[:10],
                "booking_status": str(row.get("status") or ""),
                "payment_status": payment_status,
                "vendor_portion_gbp": vendor_portion,
                "referral_fee_discount_gbp": round(discount, 2),
                "client_display_name": names.get(cid),
                "created_at": row.get("created_at")
                if isinstance(row.get("created_at"), str)
                else None,
            },
        )

    return {
        "total_referral_bookings": len(bookings),
        "total_fee_savings_gbp": round(total_savings, 2),
        "bookings": bookings,
    }
