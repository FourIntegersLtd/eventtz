"""Vendor moderation and explore-list visibility logic."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import (
    apply_recent_first_order,
    get_db as get_client,
    is_approval_status_check_violation,
    is_missing_approval_status_column,
    local_vendors,
)
from app.features.vendors.profile import get_vendor_profile

logger = get_logger(__name__)


def _log_admin_list_zero_probe(client: Any) -> None:
    """Extra logging when admin vendor list is empty (distinguish empty DB vs no vendor rows)."""
    try:
        u_total = client.table("users").select("id", count="exact", head=True).execute()
        logger.warning(
            "list_vendors_for_admin zero probe: public.users total_row_count=%s",
            getattr(u_total, "count", None),
        )
    except Exception as e:
        logger.warning("list_vendors_for_admin zero probe public.users count failed: %s", e, exc_info=True)
    try:
        ures = client.table("users").select("id,user_type").limit(50).execute()
        urows = getattr(ures, "data", None) or []
        hist: dict[str, int] = {}
        for row in urows:
            if isinstance(row, dict):
                k = str(row.get("user_type") or "?")
                hist[k] = hist.get(k, 0) + 1
        logger.warning(
            "list_vendors_for_admin zero probe: public.users sample(limit 50) rows=%s user_type_histogram=%s",
            len(urows),
            hist,
        )
    except Exception as e:
        logger.warning("list_vendors_for_admin zero probe public.users sample failed: %s", e, exc_info=True)
    try:
        v_total = client.table("vendors").select("user_id", count="exact", head=True).execute()
        logger.warning(
            "list_vendors_for_admin zero probe: public.vendors total_row_count=%s",
            getattr(v_total, "count", None),
        )
    except Exception as e:
        logger.warning("list_vendors_for_admin zero probe public.vendors count failed: %s", e, exc_info=True)


def list_vendors_for_admin() -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        out: list[dict[str, Any]] = []
        for uid, row in local_vendors.items():
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            out.append(
                {
                    "id": row.get("id"),
                    "user_id": uid,
                    "email": row.get("email"),
                    "status": row.get("status"),
                    "approval_status": row.get("approval_status", "pending"),
                    "current_step": row.get("current_step"),
                    "payload": payload,
                    "created_at": row.get("created_at"),
                    "updated_at": row.get("updated_at"),
                }
            )
        out = sorted(out, key=lambda r: str(r.get("updated_at") or ""), reverse=True)
        logger.info("list_vendors_for_admin local_mode rows=%s", len(out))
        return out

    settings = get_settings()
    supabase_host = urlparse(settings.supabase_url).netloc or "(unset)"
    client = get_client()
    # Users explicitly marked vendor in public.users
    ures = (
        client.table("users")
        .select("id,email,user_type,created_at,updated_at")
        .eq("user_type", "vendor")
        .execute()
    )
    udata = getattr(ures, "data", None) or []
    users_by_id: dict[str, dict[str, Any]] = {
        str(u["id"]): u for u in udata if isinstance(u, dict) and u.get("id")
    }
    n_users_vendor_role = len(users_by_id)

    # Every vendor profile row (includes accounts where public.users.user_type is still wrong/out of sync)
    try:
        vres = (
            client.table("vendors")
            .select("id,user_id,status,approval_status,current_step,payload,created_at,updated_at")
            .execute()
        )
    except Exception as e:
        if not is_missing_approval_status_column(e):
            raise
        logger.warning("vendors.approval_status missing for admin list; defaulting pending. Run sql/004.")
        vres = (
            client.table("vendors")
            .select("id,user_id,status,current_step,payload,created_at,updated_at")
            .execute()
        )
    vdata = getattr(vres, "data", None) or []
    by_user_id: dict[str, dict[str, Any]] = {
        str(v["user_id"]): v for v in vdata if isinstance(v, dict) and v.get("user_id")
    }
    n_vendors_rows = len(by_user_id)

    all_user_ids = set(users_by_id.keys()) | set(by_user_id.keys())
    missing_user_rows = all_user_ids - set(users_by_id.keys())
    n_extra_user_fetch = len(missing_user_rows)
    if missing_user_rows:
        extra = (
            client.table("users")
            .select("id,email,user_type,created_at,updated_at")
            .in_("id", list(missing_user_rows))
            .execute()
        )
        for u in getattr(extra, "data", None) or []:
            if isinstance(u, dict) and u.get("id"):
                users_by_id[str(u["id"])] = u

    rows: list[dict[str, Any]] = []
    for uid in all_user_ids:
        urow = users_by_id.get(uid)
        vrow = by_user_id.get(uid)
        payload = vrow.get("payload") if isinstance(vrow, dict) and isinstance(vrow.get("payload"), dict) else {}
        rows.append(
            {
                "id": vrow.get("id") if isinstance(vrow, dict) else None,
                "user_id": uid,
                "email": urow.get("email") if isinstance(urow, dict) else None,
                "status": (vrow.get("status") if isinstance(vrow, dict) else None) or "draft",
                "approval_status": (vrow.get("approval_status") if isinstance(vrow, dict) else None) or "pending",
                "current_step": (vrow.get("current_step") if isinstance(vrow, dict) else None) or 1,
                "payload": payload,
                "created_at": (vrow.get("created_at") if isinstance(vrow, dict) else None)
                or (urow.get("created_at") if isinstance(urow, dict) else None),
                "updated_at": (vrow.get("updated_at") if isinstance(vrow, dict) else None)
                or (urow.get("updated_at") if isinstance(urow, dict) else None),
            }
        )
    rows.sort(key=lambda r: str(r.get("updated_at") or ""), reverse=True)
    n_result = len(rows)
    sample_ids = list(all_user_ids)[:5]
    logger.info(
        "list_vendors_for_admin supabase_host=%s local_auth_mode=False "
        "public_users_vendor_role_count=%s public_vendors_row_count=%s "
        "merged_distinct_user_ids=%s extra_users_fetched_for_vendors_rows=%s result_rows=%s sample_user_ids=%s",
        supabase_host,
        n_users_vendor_role,
        n_vendors_rows,
        len(all_user_ids),
        n_extra_user_fetch,
        n_result,
        sample_ids,
    )
    if n_result == 0:
        _log_admin_list_zero_probe(client)
        logger.warning(
            "list_vendors_for_admin returned zero rows: no merged vendor rows. "
            "If probe shows total_row_count>0 for users/vendors but counts above are 0, "
            "check user_type values and vendors.user_id FKs. "
            "If probes are 0, this Supabase DB has no profile rows yet or a different project is selected.",
        )
    return rows


def get_vendor_admin_insights(vendor_user_id: str) -> dict[str, Any]:
    """
    Aggregates for admin vendor detail: reviews, booking pipeline, open disputes count.
    """
    if get_settings().local_auth_mode:
        return {
            "user_id": vendor_user_id,
            "review_average": None,
            "review_count": 0,
            "bookings_total": 0,
            "bookings_by_status": {},
            "open_disputes_on_bookings": 0,
            "explore_path": f"/client/browse/{vendor_user_id}",
        }

    client = get_client()
    from app.features.bookings.reviews import get_review_stats_for_vendors

    stats = get_review_stats_for_vendors([vendor_user_id])
    sm = stats.get(vendor_user_id) or {}
    avg = sm.get("average_rating")
    try:
        rc = int(sm.get("review_count") or 0)
    except (TypeError, ValueError):
        rc = 0
    try:
        fa = float(avg) if avg is not None else None
    except (TypeError, ValueError):
        fa = None

    bookings_by_status: dict[str, int] = {}
    booking_ids: list[str] = []
    try:
        br = (
            client.table("booking_requests")
            .select("id,status")
            .eq("vendor_user_id", vendor_user_id)
            .limit(5000)
            .execute()
        )
        for row in getattr(br, "data", None) or []:
            if not isinstance(row, dict):
                continue
            if row.get("id"):
                booking_ids.append(str(row["id"]))
            st = str(row.get("status") or "unknown")
            bookings_by_status[st] = bookings_by_status.get(st, 0) + 1
    except Exception as e:
        logger.warning("get_vendor_admin_insights bookings failed: %s", e, exc_info=True)

    open_disputes = 0
    if booking_ids:
        try:
            dr = (
                client.table("dispute_cases")
                .select("id", count="exact", head=True)
                .in_("booking_request_id", booking_ids[:500])
                .in_("status", ["open", "under_review"])
                .execute()
            )
            open_disputes = int(getattr(dr, "count", None) or 0)
        except Exception as e:
            err = str(e).lower()
            if "dispute_cases" in err or "42p01" in err:
                open_disputes = 0
            else:
                logger.warning("get_vendor_admin_insights disputes count failed: %s", e, exc_info=True)

    total = sum(bookings_by_status.values())
    return {
        "user_id": vendor_user_id,
        "review_average": fa,
        "review_count": rc,
        "bookings_total": total,
        "bookings_by_status": bookings_by_status,
        "open_disputes_on_bookings": open_disputes,
        "explore_path": f"/client/browse/{vendor_user_id}",
    }


def set_vendor_approval(user_id: str, approval_status: str) -> dict[str, Any] | None:
    if approval_status not in ("pending", "approved", "banned"):
        raise ValueError("approval_status must be pending, approved, or banned")
    if get_settings().local_auth_mode:
        row = local_vendors.get(user_id)
        if not row:
            return None
        row = {**row, "approval_status": approval_status}
        local_vendors[user_id] = row
        return row
    try:
        get_client().table("vendors").update({"approval_status": approval_status}).eq("user_id", user_id).execute()
    except Exception as e:
        if is_approval_status_check_violation(e):
            raise ValueError(
                "Database constraint does not allow this status yet. Run backend/sql/005_allow_banned_vendor_approval_status.sql."
            ) from e
        if not is_missing_approval_status_column(e):
            raise
        raise RuntimeError(
            "vendors.approval_status column is missing. Run backend/sql/004_vendors_approval_status.sql."
        ) from e
    return get_vendor_profile(user_id)


def list_approved_vendors_for_explore() -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        out: list[dict[str, Any]] = []
        for uid, row in local_vendors.items():
            if row.get("approval_status") != "approved":
                continue
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            out.append(
                {
                    "user_id": uid,
                    "email": row.get("email"),
                    "status": row.get("status"),
                    "approval_status": row.get("approval_status"),
                    "payload": payload,
                    "updated_at": row.get("updated_at"),
                }
            )
        return out

    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("vendors")
                .select("user_id,status,approval_status,payload,updated_at")
                .eq("approval_status", "approved"),
            )
            .execute()
        )
    except Exception as e:
        if not is_missing_approval_status_column(e):
            raise
        logger.warning("vendors.approval_status missing for explore list; returning empty list. Run sql/004.")
        return []

    data = getattr(res, "data", None) or []
    user_ids = [str(row.get("user_id")) for row in data if isinstance(row, dict) and row.get("user_id")]
    emails_by_id: dict[str, str | None] = {}
    if user_ids:
        ures = get_client().table("users").select("id,email").in_("id", user_ids).execute()
        udata = getattr(ures, "data", None) or []
        for urow in udata:
            if isinstance(urow, dict) and urow.get("id"):
                emails_by_id[str(urow["id"])] = urow.get("email")

    out: list[dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("user_id") or "")
        out.append(
            {
                "user_id": row.get("user_id"),
                "email": emails_by_id.get(uid),
                "status": row.get("status"),
                "approval_status": row.get("approval_status"),
                "payload": row.get("payload") if isinstance(row.get("payload"), dict) else {},
                "updated_at": row.get("updated_at"),
            }
        )
    return out


def get_approved_vendor_payload(vendor_user_id: str) -> dict[str, Any] | None:
    """Onboarding JSON for an approved vendor, or None if not bookable."""
    if get_settings().local_auth_mode:
        row = local_vendors.get(vendor_user_id)
        if not row or row.get("approval_status") != "approved":
            return None
        p = row.get("payload")
        return p if isinstance(p, dict) else {}

    try:
        res = (
            get_client()
            .table("vendors")
            .select("payload")
            .eq("user_id", vendor_user_id)
            .eq("approval_status", "approved")
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("get_approved_vendor_payload failed: %s", e, exc_info=True)
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    p = rows[0].get("payload")
    return p if isinstance(p, dict) else {}


def vendor_is_bookable_for_explore(vendor_user_id: str) -> bool:
    """True when vendor is approved and visible for bookings / client chat."""
    if get_settings().local_auth_mode:
        row = local_vendors.get(vendor_user_id)
        return bool(row and row.get("approval_status") == "approved")
    try:
        res = (
            get_client()
            .table("vendors")
            .select("user_id")
            .eq("user_id", vendor_user_id)
            .eq("approval_status", "approved")
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("vendor_is_bookable_for_explore failed: %s", e, exc_info=True)
        return False
    rows = getattr(res, "data", None) or []
    return bool(rows)
