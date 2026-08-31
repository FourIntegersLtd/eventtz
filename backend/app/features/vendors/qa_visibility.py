"""QA-only marketplace visibility — test vendors hidden from public explore."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.core.db import apply_recent_first_order, get_db
from app.features.auth.accounts import deleted_user_ids, fetch_user_profile, is_deleted_user_id
from app.features.vendors.markets import normalize_country_code

_EXPLORE_SELECT_COLS = (
    "user_id,status,approval_status,payload,updated_at,"
    "min_list_price_gbp,base_city_normalized,services_offered,country_code,currency"
)


@dataclass(frozen=True, slots=True)
class ExploreViewer:
    user_id: str
    email: str | None
    user_type: str


def explore_viewer_from_auth(user: Any | None) -> ExploreViewer | None:
    if user is None:
        return None
    uid = str(getattr(user, "id", None) or user.get("id") or "")
    if not uid:
        return None
    email = getattr(user, "email", None)
    if email is None and isinstance(user, dict):
        email = user.get("email")
    user_type = getattr(user, "user_type", None)
    if user_type is None and isinstance(user, dict):
        user_type = user.get("user_type")
    return ExploreViewer(
        user_id=uid,
        email=str(email) if email else None,
        user_type=str(user_type or "client"),
    )


def explore_viewer_for_client_user_id(client_user_id: str) -> ExploreViewer | None:
    profile = fetch_user_profile(str(client_user_id or "").strip())
    if not profile:
        return None
    return ExploreViewer(
        user_id=str(profile.get("id") or client_user_id),
        email=str(profile.get("email") or "") or None,
        user_type=str(profile.get("user_type") or "client"),
    )


def is_qa_scoped_vendor(vendor_user_id: str) -> bool:
    uid = str(vendor_user_id or "").strip()
    if not uid:
        return False
    return uid in get_settings().qa_scoped_vendor_ids


def viewer_may_see_qa_vendor(viewer: ExploreViewer | None, vendor_user_id: str) -> bool:
    if viewer is None or viewer.user_type != "client":
        return False
    email = (viewer.email or "").strip().lower()
    if not email:
        return False
    allowed = get_settings().qa_client_vendor_visibility_map.get(email)
    if not allowed:
        return False
    return str(vendor_user_id or "").strip() in allowed


def filter_explore_rows(
    rows: list[dict[str, Any]],
    viewer: ExploreViewer | None,
) -> list[dict[str, Any]]:
    """Drop QA-scoped vendors unless the viewer is the designated test client."""
    out: list[dict[str, Any]] = []
    for row in rows:
        uid = str(row.get("user_id") or "")
        if is_qa_scoped_vendor(uid) and not viewer_may_see_qa_vendor(viewer, uid):
            continue
        out.append(row)
    return out


def _explore_row_from_vendor_row(row: dict[str, Any], email: str | None) -> dict[str, Any]:
    return {
        "user_id": row.get("user_id"),
        "email": email,
        "status": row.get("status"),
        "approval_status": row.get("approval_status"),
        "payload": row.get("payload") if isinstance(row.get("payload"), dict) else {},
        "updated_at": row.get("updated_at"),
    }


def _attach_emails(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    user_ids = [str(r.get("user_id")) for r in rows if r.get("user_id")]
    gone = deleted_user_ids(user_ids)
    emails_by_id: dict[str, str | None] = {}
    if user_ids:
        try:
            ures = get_db().table("users").select("id,email").in_("id", user_ids).execute()
            for urow in getattr(ures, "data", None) or []:
                if isinstance(urow, dict) and urow.get("id"):
                    emails_by_id[str(urow["id"])] = urow.get("email")
        except Exception:
            pass

    out: list[dict[str, Any]] = []
    for row in rows:
        uid = str(row.get("user_id") or "")
        if uid in gone:
            continue
        out.append(_explore_row_from_vendor_row(row, emails_by_id.get(uid)))
    return out


def _fetch_approved_vendor_rows_by_ids(
    vendor_user_ids: list[str],
    *,
    country_code: str,
) -> list[dict[str, Any]]:
    ids = [str(v).strip() for v in vendor_user_ids if str(v).strip()]
    if not ids:
        return []
    country = normalize_country_code(country_code)
    try:
        res = (
            apply_recent_first_order(
                get_db()
                .table("vendors")
                .select(_EXPLORE_SELECT_COLS)
                .eq("approval_status", "approved")
                .eq("country_code", country)
                .in_("user_id", ids[:500]),
                column="updated_at",
            )
            .execute()
        )
    except Exception:
        res = (
            apply_recent_first_order(
                get_db()
                .table("vendors")
                .select("user_id,status,approval_status,payload,updated_at")
                .eq("approval_status", "approved")
                .in_("user_id", ids[:500]),
                column="updated_at",
            )
            .execute()
        )
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    return _attach_emails(rows)


def fetch_qa_vendors_for_viewer(
    viewer: ExploreViewer | None,
    *,
    country_code: str | None = None,
) -> list[dict[str, Any]]:
    if viewer is None or viewer.user_type != "client":
        return []
    email = (viewer.email or "").strip().lower()
    vendor_ids = get_settings().qa_client_vendor_visibility_map.get(email)
    if not vendor_ids:
        return []
    return _fetch_approved_vendor_rows_by_ids(
        list(vendor_ids),
        country_code=normalize_country_code(country_code),
    )


def fetch_qa_vendor_for_explore_by_id(
    vendor_user_id: str,
    viewer: ExploreViewer | None,
) -> dict[str, Any] | None:
    uid = str(vendor_user_id or "").strip()
    if not uid or not is_qa_scoped_vendor(uid):
        return None
    if not viewer_may_see_qa_vendor(viewer, uid):
        return None
    if is_deleted_user_id(uid):
        return None
    try:
        res = (
            get_db()
            .table("vendors")
            .select("user_id,status,approval_status,payload,updated_at")
            .eq("user_id", uid)
            .eq("approval_status", "approved")
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    email = None
    try:
        ures = get_db().table("users").select("email").eq("id", uid).limit(1).execute()
        urows = getattr(ures, "data", None) or []
        if urows and isinstance(urows[0], dict):
            email = urows[0].get("email")
    except Exception:
        pass
    return _explore_row_from_vendor_row(rows[0], email)


def fetch_qa_vendor_payload(
    vendor_user_id: str,
    viewer: ExploreViewer | None,
    *,
    operator: bool = False,
) -> dict[str, Any] | None:
    uid = str(vendor_user_id or "").strip()
    if not uid or not is_qa_scoped_vendor(uid):
        return None
    if not operator and not viewer_may_see_qa_vendor(viewer, uid):
        return None
    if is_deleted_user_id(uid):
        return None
    try:
        res = (
            get_db()
            .table("vendors")
            .select("payload")
            .eq("user_id", uid)
            .eq("approval_status", "approved")
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    payload = rows[0].get("payload")
    return payload if isinstance(payload, dict) else {}
