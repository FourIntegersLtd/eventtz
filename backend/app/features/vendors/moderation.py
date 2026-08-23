"""Vendor approval, admin lists, and who appears in explore."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.auth.accounts import deleted_user_ids, is_deleted_user_id
from app.features.vendors.markets import normalize_country_code
from app.core.db import (
    apply_recent_first_order,
    get_db,
    is_approval_status_check_violation,
    is_missing_approval_status_column,
)
from app.features.vendors.profile import get_vendor_profile
from app.features.vendors import messages as vendor_messages
from app.features.vendors.visibility import (
    LISTING_OVERRIDES,
    LISTING_OVERRIDE_COLS,
    PUBLIC_LISTING_STRIPE_COLS,
    apply_public_listing_filters,
    is_missing_public_listing_column,
    listing_override_of,
    row_is_publicly_listable,
    vendor_payouts_verified,
)
from app.features.email.dispatch import (
    send_vendor_approval_email,
    send_vendor_complete_profile_nudge_email,
    send_vendor_returned_for_edits_email,
    send_vendor_setup_payouts_nudge_email,
)

logger = get_logger(__name__)


def _booking_month_key(iso: Any) -> str | None:
    if not iso:
        return None
    s = str(iso).strip()
    return s[:7] if len(s) >= 7 else None


def _log_admin_list_zero_probe(client: Any) -> None:
    """Extra logging when the admin vendor list is empty (empty database vs no vendor rows)."""
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
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    client = get_db()
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

    base_cols = "id,user_id,status,approval_status,current_step,payload,created_at,updated_at"
    listing_cols = ",".join((*PUBLIC_LISTING_STRIPE_COLS, *LISTING_OVERRIDE_COLS))

    def _run(select_cols: str) -> Any:
        query = apply_recent_first_order(
            client.table("vendors").select(select_cols, count="exact"),
            column="updated_at",
        )
        if match_ids is not None:
            query = query.in_("user_id", match_ids)
        if approval_status and approval_status.strip():
            query = query.eq("approval_status", approval_status.strip())
        if status and status.strip():
            query = query.eq("status", status.strip())
        return query.range(offset, offset + limit - 1).execute()

    try:
        res = _run(f"{base_cols},{listing_cols}")
    except Exception as e:
        if is_missing_approval_status_column(e) and approval_status:
            logger.warning("list_vendors_for_admin approval filter skipped: %s", e)
            return [], 0
        if not is_missing_public_listing_column(e):
            logger.warning("list_vendors_for_admin failed: %s", e, exc_info=True)
            return [], 0
        # Stripe/override columns lag behind the code: still show the roster rather
        # than an empty admin console, just without the listing detail.
        logger.warning("list_vendors_for_admin listing columns missing; run sql/061-062. %s", e)
        try:
            res = _run(base_cols)
        except Exception as inner:
            logger.warning("list_vendors_for_admin failed: %s", inner, exc_info=True)
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
                "stripe_account_id": vrow.get("stripe_account_id"),
                "stripe_charges_enabled": bool(vrow.get("stripe_charges_enabled")),
                "stripe_payouts_enabled": bool(vrow.get("stripe_payouts_enabled")),
                "payouts_verified": vendor_payouts_verified(vrow),
                "listing_visible": row_is_publicly_listable(vrow),
                "listing_override": listing_override_of(vrow),
                "listing_override_reason": vrow.get("listing_override_reason"),
            }
        )
    return rows, total


def list_vendor_user_ids_for_broadcast() -> list[str]:
    """All vendor user IDs - for sending an admin message to every vendor."""
    client = get_db()
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
    Summary counts for the admin vendor detail page: reviews, bookings, open disputes.
    """
    client = get_db()
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
    bookings_by_month_map: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    booking_ids: list[str] = []
    try:
        br = (
            client.table("booking_requests")
            .select("id,status,created_at")
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
            month_key = _booking_month_key(row.get("created_at"))
            if month_key:
                bookings_by_month_map[month_key][st] += 1
    except Exception as e:
        logger.warning("get_vendor_admin_insights bookings failed: %s", e, exc_info=True)

    status_keys = sorted(bookings_by_status.keys())
    bookings_by_month = [
        {
            "month": month,
            **{status: int(bookings_by_month_map[month].get(status, 0)) for status in status_keys},
        }
        for month in sorted(bookings_by_month_map.keys())
    ]

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
        "bookings_by_month": bookings_by_month,
        "open_disputes_on_bookings": open_disputes,
        "explore_path": f"/client/browse/{vendor_user_id}",
    }


def _notify_vendor_approval_change(
    user_id: str,
    row: dict[str, Any] | None,
    *,
    approval_status: str,
    previous_status: str | None,
) -> None:
    """Email the vendor, but only when an admin actually changed their approval state.

    Pass the row read back *after* the update: the listing flags on it pick which of the
    three approved emails goes out (live / finish payouts / listing paused), so a
    pre-update row would send the wrong one. Email failures never fail the moderation
    action - the admin's decision is already saved.
    """
    if not row or previous_status == approval_status:
        return
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    business_name = payload.get("businessName")
    try:
        send_vendor_approval_email(
            vendor_user_id=user_id,
            vendor_email=None,
            approval_status=approval_status,
            business_name=business_name.strip() if isinstance(business_name, str) else None,
            listing_visible=bool(row.get("listing_visible")),
            payouts_verified=bool(row.get("payouts_verified")),
        )
    except Exception:
        logger.warning("vendor approval email failed user=%s", user_id, exc_info=True)


def _notify_vendor_returned_for_edits(
    user_id: str,
    row: dict[str, Any] | None,
    *,
    admin_message: str | None = None,
) -> bool:
    if not row:
        return False
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    business_name = payload.get("businessName")
    try:
        return send_vendor_returned_for_edits_email(
            vendor_user_id=user_id,
            vendor_email=None,
            business_name=business_name.strip() if isinstance(business_name, str) else None,
            admin_message=admin_message,
        )
    except Exception:
        logger.warning("vendor return-for-edits email failed user=%s", user_id, exc_info=True)
        return False


def nudge_draft_vendors_to_complete_profile(user_ids: list[str]) -> dict[str, Any]:
    """Email draft vendors encouraging them to finish and submit their profile."""
    seen: set[str] = set()
    sent = 0
    skipped = 0
    failures: list[dict[str, str]] = []

    for raw_id in user_ids:
        user_id = str(raw_id or "").strip()
        if not user_id or user_id in seen:
            continue
        seen.add(user_id)

        row = get_vendor_profile(user_id)
        if not row:
            failures.append({"user_id": user_id, "error": vendor_messages.VENDOR_PROFILE_NOT_FOUND})
            continue

        status = str(row.get("status") or "draft")
        if status != "draft":
            skipped += 1
            continue

        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        business_name = payload.get("businessName")
        try:
            ok = send_vendor_complete_profile_nudge_email(
                vendor_user_id=user_id,
                vendor_email=row.get("email") if isinstance(row.get("email"), str) else None,
                business_name=business_name.strip() if isinstance(business_name, str) else None,
            )
        except Exception:
            logger.warning("vendor profile nudge email failed user=%s", user_id, exc_info=True)
            failures.append({"user_id": user_id, "error": vendor_messages.EMAIL_COULD_NOT_BE_SENT})
            continue

        if ok:
            sent += 1
        else:
            failures.append({"user_id": user_id, "error": vendor_messages.NO_EMAIL_ON_FILE})

    return {"sent": sent, "skipped": skipped, "failures": failures}


def nudge_vendors_to_setup_payouts(user_ids: list[str]) -> dict[str, Any]:
    """Email approved vendors who have not finished Stripe payout setup."""
    seen: set[str] = set()
    sent = 0
    skipped = 0
    failures: list[dict[str, str]] = []

    for raw_id in user_ids:
        user_id = str(raw_id or "").strip()
        if not user_id or user_id in seen:
            continue
        seen.add(user_id)

        row = get_vendor_profile(user_id)
        if not row:
            failures.append({"user_id": user_id, "error": vendor_messages.VENDOR_PROFILE_NOT_FOUND})
            continue

        approval = str(row.get("approval_status") or "pending")
        if approval != "approved" or vendor_payouts_verified(row):
            skipped += 1
            continue

        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        business_name = payload.get("businessName")
        try:
            ok = send_vendor_setup_payouts_nudge_email(
                vendor_user_id=user_id,
                vendor_email=row.get("email") if isinstance(row.get("email"), str) else None,
                business_name=business_name.strip() if isinstance(business_name, str) else None,
            )
        except Exception:
            logger.warning("vendor payout nudge email failed user=%s", user_id, exc_info=True)
            failures.append({"user_id": user_id, "error": vendor_messages.EMAIL_COULD_NOT_BE_SENT})
            continue

        if ok:
            sent += 1
        else:
            failures.append({"user_id": user_id, "error": vendor_messages.NO_EMAIL_ON_FILE})

    return {"sent": sent, "skipped": skipped, "failures": failures}


def unsubmit_vendor_profile(
    user_id: str,
    *,
    send_email: bool = True,
    admin_message: str | None = None,
) -> tuple[dict[str, Any] | None, bool]:
    """Return a submitted vendor profile to draft so they can edit onboarding again."""
    row = get_vendor_profile(user_id)
    if not row:
        return None, False
    status = str(row.get("status") or "draft")
    approval = str(row.get("approval_status") or "pending")
    if status != "submitted":
        raise ValueError(vendor_messages.ONLY_SUBMITTED_PROFILES_TO_DRAFT)
    if approval != "pending":
        raise ValueError(vendor_messages.ONLY_PENDING_VENDORS_TO_DRAFT)
    email_sent = False
    payload = dict(row.get("payload") or {}) if isinstance(row.get("payload"), dict) else {}
    payload["returnedForEditsAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    get_db().table("vendors").update(
        {"status": "draft", "current_step": 8, "payload": payload}
    ).eq("user_id", user_id).execute()
    updated = get_vendor_profile(user_id)
    if send_email and updated:
        email_sent = _notify_vendor_returned_for_edits(
            user_id, updated, admin_message=admin_message
        )
    return updated, email_sent


def set_vendor_approval(user_id: str, approval_status: str) -> dict[str, Any] | None:
    if approval_status not in ("pending", "approved", "banned"):
        raise ValueError(vendor_messages.APPROVAL_STATUS_INVALID)
    previous = get_vendor_profile(user_id)
    prev_status = str(previous.get("approval_status") or "pending") if previous else None
    patch: dict[str, Any] = {"approval_status": approval_status}
    if approval_status == "approved" and prev_status != "approved":
        patch["approved_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    try:
        get_db().table("vendors").update(patch).eq("user_id", user_id).execute()
    except Exception as e:
        if "approved_at" in patch and (
            "approved_at" in str(e).lower() or getattr(e, "code", None) == "42703"
        ):
            logger.warning("vendors.approved_at missing; run backend/sql/076_high_impact_reminders.sql")
            try:
                get_db().table("vendors").update({"approval_status": approval_status}).eq(
                    "user_id",
                    user_id,
                ).execute()
            except Exception as inner:
                e = inner
            else:
                e = None
        if e is not None:
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
    _notify_vendor_approval_change(
        user_id,
        row,
        approval_status=approval_status,
        previous_status=prev_status,
    )
    return row


def set_vendor_listing_override(
    user_id: str,
    listing_override: str,
    *,
    reason: str | None = None,
    admin_user_id: str | None = None,
) -> dict[str, Any] | None:
    """Force a vendor's marketplace listing on or off, or hand it back to the automatic rule.

    `visible` waives the Stripe requirement for a vendor Eventtz has vetted another way;
    `hidden` takes a listing down without a ban. Neither can list an unapproved or banned
    vendor - approval is checked first, everywhere the rule is applied.
    """
    if listing_override not in LISTING_OVERRIDES:
        raise ValueError(vendor_messages.LISTING_OVERRIDE_INVALID)
    clean_reason = (reason or "").strip() or None
    if listing_override != "auto" and not clean_reason:
        raise ValueError(vendor_messages.LISTING_OVERRIDE_REASON_REQUIRED)

    update = {
        "listing_override": listing_override,
        "listing_override_reason": clean_reason,
        "listing_override_by": admin_user_id or None,
        "listing_override_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        get_db().table("vendors").update(update).eq("user_id", user_id).execute()
    except Exception as e:
        if is_missing_public_listing_column(e):
            raise RuntimeError(
                "vendors.listing_override column is missing. Run backend/sql/062_vendor_listing_override.sql."
            ) from e
        raise
    return get_vendor_profile(user_id)


def list_approved_vendors_for_explore(
    *,
    vendor_user_ids: list[str] | None = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
    service_types: list[str] | None = None,
    city_query: str | None = None,
    country_code: str | None = None,
) -> list[dict[str, Any]]:
    select_cols = (
        "user_id,status,approval_status,payload,updated_at,"
        "min_list_price_gbp,base_city_normalized,services_offered,country_code,currency"
    )
    country = normalize_country_code(country_code)
    try:
        query = apply_recent_first_order(
            apply_public_listing_filters(
                get_db().table("vendors").select(select_cols),
            ).eq("country_code", country),
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
        if is_missing_public_listing_column(e):
            query = apply_recent_first_order(
                get_db()
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
    gone = deleted_user_ids(user_ids)
    emails_by_id: dict[str, str | None] = {}
    if user_ids:
        ures = get_db().table("users").select("id,email").in_("id", user_ids).execute()
        udata = getattr(ures, "data", None) or []
        for urow in udata:
            if isinstance(urow, dict) and urow.get("id"):
                emails_by_id[str(urow["id"])] = urow.get("email")

    out: list[dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("user_id") or "")
        if uid in gone:
            continue
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
    """One listable vendor for the browse detail page (direct lookup, not a full list scan)."""
    try:
        res = (
            apply_public_listing_filters(
                get_db()
                .table("vendors")
                .select("user_id,status,approval_status,payload,updated_at")
                .eq("user_id", vendor_user_id),
            )
            .limit(1)
            .execute()
        )
    except Exception as e:
        if is_missing_approval_status_column(e) or is_missing_public_listing_column(e):
            return None
        raise
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    uid = str(row.get("user_id") or "")
    if uid and is_deleted_user_id(uid):
        return None
    email = None
    try:
        ures = get_db().table("users").select("email").eq("id", uid).limit(1).execute()
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


def get_bookable_vendor_profile_form_data(vendor_user_id: str) -> dict[str, Any] | None:
    """Onboarding profile JSON for a listable vendor, or None if they cannot be booked."""
    if vendor_user_id and is_deleted_user_id(vendor_user_id):
        return None
    try:
        res = (
            apply_public_listing_filters(
                get_db().table("vendors").select("payload").eq("user_id", vendor_user_id),
            )
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("get_bookable_vendor_profile_form_data failed: %s", e, exc_info=True)
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    p = rows[0].get("payload")
    return p if isinstance(p, dict) else {}


def vendor_is_bookable_for_explore(vendor_user_id: str) -> bool:
    """True when the vendor is approved, Stripe-verified, and clients can book or message them."""
    if vendor_user_id and is_deleted_user_id(vendor_user_id):
        return False
    try:
        res = (
            apply_public_listing_filters(
                get_db().table("vendors").select("user_id").eq("user_id", vendor_user_id),
            )
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("vendor_is_bookable_for_explore failed: %s", e, exc_info=True)
        return False
    rows = getattr(res, "data", None) or []
    return bool(rows)
