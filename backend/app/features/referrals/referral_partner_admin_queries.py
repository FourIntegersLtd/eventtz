"""Admin lists for referral partners and attributed vendor signups."""

from __future__ import annotations

from typing import Any, Literal

from app.core.db import get_db as get_client
from app.features.referrals.partners import get_partner_by_id

ShoutoutFilter = Literal["all", "pending", "completed"]


def _payload_str(payload: dict[str, Any] | None, key: str) -> str | None:
    if not payload:
        return None
    val = payload.get(key)
    if val is None:
        return None
    s = str(val).strip()
    return s or None


def list_partner_signups(
    partner_id: str,
    *,
    offset: int = 0,
    limit: int = 50,
    shoutout: ShoutoutFilter = "all",
) -> tuple[dict[str, Any] | None, list[dict[str, Any]], int]:
    partner = get_partner_by_id(partner_id)
    if not partner:
        return None, [], 0

    q = (
        get_client()
        .table("referral_attributions")
        .select("user_id, referral_slug, attributed_at, shoutout_completed, shoutout_completed_at", count="exact")
        .eq("referral_partner_id", partner_id)
    )
    if shoutout == "pending":
        q = q.eq("shoutout_completed", False)
    elif shoutout == "completed":
        q = q.eq("shoutout_completed", True)

    res = q.order("attributed_at", desc=True).range(offset, offset + limit - 1).execute()
    attr_rows = getattr(res, "data", None) or []
    total = int(getattr(res, "count", None) or 0)

    if not attr_rows:
        return partner, [], total

    user_ids = [str(r.get("user_id")) for r in attr_rows if isinstance(r, dict) and r.get("user_id")]
    users_by_id: dict[str, dict[str, Any]] = {}
    vendors_by_user: dict[str, dict[str, Any]] = {}

    if user_ids:
        ures = get_client().table("users").select("id, email").in_("id", user_ids).execute()
        for u in getattr(ures, "data", None) or []:
            if isinstance(u, dict) and u.get("id"):
                users_by_id[str(u["id"])] = u

        vres = (
            get_client()
            .table("vendors")
            .select("user_id, status, approval_status, payload")
            .in_("user_id", user_ids)
            .execute()
        )
        for v in getattr(vres, "data", None) or []:
            if isinstance(v, dict) and v.get("user_id"):
                vendors_by_user[str(v["user_id"])] = v

    signups: list[dict[str, Any]] = []
    for row in attr_rows:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("user_id") or "")
        user = users_by_id.get(uid, {})
        vendor = vendors_by_user.get(uid, {})
        payload = vendor.get("payload") if isinstance(vendor.get("payload"), dict) else {}
        signups.append(
            {
                "user_id": uid,
                "email": user.get("email"),
                "business_name": _payload_str(payload, "businessName"),
                "approval_status": vendor.get("approval_status"),
                "profile_status": vendor.get("status"),
                "attributed_at": row.get("attributed_at"),
                "shoutout_completed": bool(row.get("shoutout_completed")),
                "shoutout_completed_at": row.get("shoutout_completed_at"),
                "explore_path": f"/client/browse/{uid}" if uid else None,
            }
        )

    return partner, signups, total


def get_signup_row(user_id: str) -> dict[str, Any] | None:
    res = (
        get_client()
        .table("referral_attributions")
        .select("user_id, referral_partner_id, referral_slug, attributed_at, shoutout_completed, shoutout_completed_at")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    uid = str(row.get("user_id") or "")
    user_res = get_client().table("users").select("id, email").eq("id", uid).limit(1).execute()
    user_rows = getattr(user_res, "data", None) or []
    user = user_rows[0] if user_rows and isinstance(user_rows[0], dict) else {}
    vendor_res = (
        get_client()
        .table("vendors")
        .select("user_id, status, approval_status, payload")
        .eq("user_id", uid)
        .limit(1)
        .execute()
    )
    vendor_rows = getattr(vendor_res, "data", None) or []
    vendor = vendor_rows[0] if vendor_rows and isinstance(vendor_rows[0], dict) else {}
    payload = vendor.get("payload") if isinstance(vendor.get("payload"), dict) else {}
    return {
        "user_id": uid,
        "email": user.get("email"),
        "business_name": _payload_str(payload, "businessName"),
        "approval_status": vendor.get("approval_status"),
        "profile_status": vendor.get("status"),
        "attributed_at": row.get("attributed_at"),
        "shoutout_completed": bool(row.get("shoutout_completed")),
        "shoutout_completed_at": row.get("shoutout_completed_at"),
        "explore_path": f"/client/browse/{uid}" if uid else None,
    }
