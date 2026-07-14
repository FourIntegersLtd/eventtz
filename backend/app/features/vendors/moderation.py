"""Vendor moderation and explore-list visibility logic."""

from __future__ import annotations

from typing import Any

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
from app.features.email.dispatch import send_vendor_approval_email

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


def list_vendors_for_admin(
    *,
    offset: int = 0,
    limit: int = 50,
    q: str | None = None,
    approval_status: str | None = None,
    status: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
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
        term = (q or "").strip().lower()
        if term:
            out = [
                r
                for r in out
                if term in str(r.get("email") or "").lower()
                or term in str((r.get("payload") or {}).get("businessName") or "").lower()
            ]
        if approval_status:
            out = [r for r in out if str(r.get("approval_status") or "") == approval_status]
        if status:
            out = [r for r in out if str(r.get("status") or "") == status]
        out = sorted(out, key=lambda r: str(r.get("updated_at") or ""), reverse=True)
        total = len(out)
        return out[offset : offset + limit], total

    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    client = get_client()
    match_ids: list[str] | None = None
    term = (q or "").strip()
    if term:
        pattern = f"%{term}%"
        id_set: set[str] = set()
        try:
            ures = (
                client.table("users")
                .select("id")
                .eq("user_type", "vendor")
                .ilike("email", pattern)
                .limit(500)
                .execute()
            )
            for row in getattr(ures, "data", None) or []:
                if isinstance(row, dict) and row.get("id"):
                    id_set.add(str(row["id"]))
        except Exception as e:
            logger.warning("list_vendors_for_admin email search failed: %s", e, exc_info=True)
        try:
            vres = (
                client.table("vendors")
                .select("user_id")
                .ilike("business_name_normalized", pattern)
                .limit(500)
                .execute()
            )
            for row in getattr(vres, "data", None) or []:
                if isinstance(row, dict) and row.get("user_id"):
                    id_set.add(str(row["user_id"]))
        except Exception as e:
            logger.warning("list_vendors_for_admin name search failed: %s", e, exc_info=True)
        if not id_set:
            return [], 0
        match_ids = list(id_set)

    vendor_select = "id,user_id,status,approval_status,current_step,payload,created_at,updated_at"
    try:
        query = apply_recent_first_order(
            client.table("vendors").select(vendor_select, count="exact"),
            column="updated_at",
        )
    except Exception:
        vendor_select = "id,user_id,status,current_step,payload,created_at,updated_at"
        query = apply_recent_first_order(
            client.table("vendors").select(vendor_select, count="exact"),
            column="updated_at",
        )

    if match_ids is not None:
        query = query.in_("user_id", match_ids)
    if approval_status and approval_status.strip():
        query = query.eq("approval_status", approval_status.strip())
    if status and status.strip():
        query = query.eq("status", status.strip())

    try:
        res = query.range(offset, offset + limit - 1).execute()
    except Exception as e:
        if is_missing_approval_status_column(e) and approval_status:
            logger.warning("list_vendors_for_admin approval filter skipped: %s", e)
            return [], 0
        logger.warning("list_vendors_for_admin failed: %s", e, exc_info=True)
        return [], 0

    vdata = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    total = int(getattr(res, "count", None) or len(vdata))
    user_ids = [str(v.get("user_id") or "") for v in vdata if v.get("user_id")]
    emails_by_id: dict[str, str | None] = {}
    if user_ids:
        ures = client.table("users").select("id,email").in_("id", user_ids).execute()
        for urow in getattr(ures, "data", None) or []:
            if isinstance(urow, dict) and urow.get("id"):
                emails_by_id[str(urow["id"])] = urow.get("email")

    rows: list[dict[str, Any]] = []
    for vrow in vdata:
        uid = str(vrow.get("user_id") or "")
        payload = vrow.get("payload") if isinstance(vrow.get("payload"), dict) else {}
        rows.append(
            {
                "id": vrow.get("id"),
                "user_id": uid,
                "email": emails_by_id.get(uid),
                "status": vrow.get("status") or "draft",
                "approval_status": vrow.get("approval_status") or "pending",
                "current_step": vrow.get("current_step") or 1,
                "payload": payload,
                "created_at": vrow.get("created_at"),
                "updated_at": vrow.get("updated_at"),
            }
        )
    return rows, total


def list_vendor_user_ids_for_broadcast() -> list[str]:
    """All vendor user IDs — for admin message fan-out."""
    if get_settings().local_auth_mode:
        return list(local_vendors.keys())
    client = get_client()
    ids: set[str] = set()
    try:
        vres = client.table("vendors").select("user_id").execute()
        for row in getattr(vres, "data", None) or []:
            if isinstance(row, dict) and row.get("user_id"):
                ids.add(str(row["user_id"]))
    except Exception as e:
        logger.warning("list_vendor_user_ids_for_broadcast vendors failed: %s", e, exc_info=True)
    try:
        ures = client.table("users").select("id").eq("user_type", "vendor").execute()
        for row in getattr(ures, "data", None) or []:
            if isinstance(row, dict) and row.get("id"):
                ids.add(str(row["id"]))
    except Exception as e:
        logger.warning("list_vendor_user_ids_for_broadcast users failed: %s", e, exc_info=True)
    return list(ids)


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
    previous = get_vendor_profile(user_id)
    prev_status = str(previous.get("approval_status") or "pending") if previous else None
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
    row = get_vendor_profile(user_id)
    if row and prev_status != approval_status:
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        bn = payload.get("businessName")
        business_name = bn.strip() if isinstance(bn, str) else None
        try:
            send_vendor_approval_email(
                vendor_user_id=user_id,
                vendor_email=None,
                approval_status=approval_status,
                business_name=business_name,
            )
        except Exception:
            logger.warning("vendor approval email failed user=%s", user_id, exc_info=True)
    return row


def list_approved_vendors_for_explore(
    *,
    vendor_user_ids: list[str] | None = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
    service_types: list[str] | None = None,
    city_query: str | None = None,
) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        out: list[dict[str, Any]] = []
        for uid, row in local_vendors.items():
            if row.get("approval_status") != "approved":
                continue
            if vendor_user_ids is not None and uid not in vendor_user_ids:
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

    select_cols = (
        "user_id,status,approval_status,payload,updated_at,"
        "min_list_price_gbp,base_city_normalized,services_offered"
    )
    try:
        query = apply_recent_first_order(
            get_client()
            .table("vendors")
            .select(select_cols)
            .eq("approval_status", "approved"),
            column="updated_at",
        )
        if vendor_user_ids:
            query = query.in_("user_id", vendor_user_ids[:500])
        if budget_min is not None:
            query = query.gte("min_list_price_gbp", budget_min)
        if budget_max is not None:
            query = query.lte("min_list_price_gbp", budget_max)
        if service_types:
            query = query.overlaps("services_offered", service_types)
        city = (city_query or "").strip().lower()
        if city:
            query = query.ilike("base_city_normalized", f"%{city}%")
        res = query.execute()
    except Exception as e:
        err = str(e).lower()
        if "min_list_price_gbp" in err or "services_offered" in err or "42703" in err:
            query = apply_recent_first_order(
                get_client()
                .table("vendors")
                .select("user_id,status,approval_status,payload,updated_at")
                .eq("approval_status", "approved"),
                column="updated_at",
            )
            if vendor_user_ids:
                query = query.in_("user_id", vendor_user_ids[:500])
            res = query.execute()
        elif is_missing_approval_status_column(e):
            logger.warning("vendors.approval_status missing for explore list; returning empty list. Run sql/004.")
            return []
        else:
            raise

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


def get_approved_vendor_for_explore_by_id(vendor_user_id: str) -> dict[str, Any] | None:
    """Single approved vendor row for browse detail (no full-list scan)."""
    if get_settings().local_auth_mode:
        row = local_vendors.get(vendor_user_id)
        if not row or row.get("approval_status") != "approved":
            return None
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        return {
            "user_id": vendor_user_id,
            "email": row.get("email"),
            "status": row.get("status"),
            "approval_status": row.get("approval_status"),
            "payload": payload,
            "updated_at": row.get("updated_at"),
        }
    try:
        res = (
            get_client()
            .table("vendors")
            .select("user_id,status,approval_status,payload,updated_at")
            .eq("user_id", vendor_user_id)
            .eq("approval_status", "approved")
            .limit(1)
            .execute()
        )
    except Exception as e:
        if is_missing_approval_status_column(e):
            return None
        raise
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    uid = str(row.get("user_id") or "")
    email = None
    try:
        ures = get_client().table("users").select("email").eq("id", uid).limit(1).execute()
        urows = getattr(ures, "data", None) or []
        if urows and isinstance(urows[0], dict):
            email = urows[0].get("email")
    except Exception:
        pass
    return {
        "user_id": row.get("user_id"),
        "email": email,
        "status": row.get("status"),
        "approval_status": row.get("approval_status"),
        "payload": row.get("payload") if isinstance(row.get("payload"), dict) else {},
        "updated_at": row.get("updated_at"),
    }


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
