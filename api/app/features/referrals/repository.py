"""Database access for referral partners, attributions and vendor client codes. The only querying file.

Two tables belong to this slice (`referral_partners`, `referral_attributions`). It also
reads the referral columns of `vendors` and `booking_requests` directly for now; those
reads move behind `vendors.service` and `bookings.service` when those slices are rebuilt.
"""

from __future__ import annotations

from typing import Any

from postgrest.exceptions import APIError
from postgrest.types import CountMethod

from app.core import db
from app.features.referrals.domain import ShoutoutFilter
from app.features.referrals.models import (
    AttributionRow,
    PartnerRow,
    ReferralBookingRow,
    SignupVendorRow,
    VendorCodeRow,
)

# PostgREST's "requested range not satisfiable": an offset past the last row when counting.
_RANGE_NOT_SATISFIABLE = "PGRST103"
# Postgres unique-constraint violation.
_UNIQUE_VIOLATION = "23505"

# --- creator partners --------------------------------------------------------------------------

_PARTNER_COLUMNS = "id,slug,display_name,instagram_handle,notes,is_active,created_at,updated_at"


def list_partners_newest_first() -> list[PartnerRow]:
    """Every partner, most recently created first."""
    result = (
        db.service_client()
        .table("referral_partners")
        .select(_PARTNER_COLUMNS)
        .order("created_at", desc=True)
        .execute()
    )
    return [PartnerRow.model_validate(row) for row in db.rows(result)]


def find_partner(partner_id: str) -> PartnerRow | None:
    """One partner by id (the caller has checked it is a UUID)."""
    result = (
        db.service_client()
        .table("referral_partners")
        .select(_PARTNER_COLUMNS)
        .eq("id", partner_id)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return PartnerRow.model_validate(row) if row else None


def find_partner_by_slug(slug: str, *, active_only: bool) -> PartnerRow | None:
    """One partner by exact slug, optionally only if switched on."""
    query = db.service_client().table("referral_partners").select(_PARTNER_COLUMNS).eq("slug", slug)
    if active_only:
        query = query.eq("is_active", True)
    row = db.first(query.limit(1).execute())
    return PartnerRow.model_validate(row) if row else None


def slugs_starting_with(prefix: str) -> set[str]:
    """Every slug that begins with `prefix`, to pick the first free `prefix-N` in one query.

    Valid slugs contain only letters, digits and dashes, so `prefix` has no LIKE wildcards.
    """
    result = (
        db.service_client().table("referral_partners").select("slug").like("slug", f"{prefix}%").execute()
    )
    return {str(row["slug"]) for row in db.rows(result) if row.get("slug")}


def insert_partner(values: dict[str, Any]) -> PartnerRow | None:
    """Store a new partner and return it, or `None` if the insert returned no row."""
    row = db.first(db.service_client().table("referral_partners").insert(values).execute())
    return PartnerRow.model_validate(row) if row else None


def update_partner(partner_id: str, changes: dict[str, Any]) -> PartnerRow | None:
    """Apply `changes` to a partner and return it, or `None` when no partner has that id."""
    row = db.first(
        db.service_client().table("referral_partners").update(changes).eq("id", partner_id).execute()
    )
    return PartnerRow.model_validate(row) if row else None


# --- attributions (vendors who signed up through a partner) ------------------------------------

_ATTRIBUTION_COLUMNS = (
    "user_id,referral_partner_id,referral_slug,attributed_at,shoutout_completed,shoutout_completed_at"
)


def _counted_attributions_query(partner_id: str, shoutout: ShoutoutFilter) -> Any:
    """The partner's attributions, filtered by shout-out state, with an exact total count."""
    query = (
        db.service_client()
        .table("referral_attributions")
        .select(_ATTRIBUTION_COLUMNS, count=CountMethod.exact)
        .eq("referral_partner_id", partner_id)
    )
    if shoutout == "pending":
        query = query.eq("shoutout_completed", False)
    elif shoutout == "completed":
        query = query.eq("shoutout_completed", True)
    return query


def list_attributions_page(
    partner_id: str, *, shoutout: ShoutoutFilter, offset: int, limit: int
) -> tuple[list[AttributionRow], int]:
    """One page of a partner's attributions, newest first, and how many match in total.

    An offset past the end is an empty page with the true total (the baseline answered 500).
    """
    try:
        result = (
            _counted_attributions_query(partner_id, shoutout)
            .order("attributed_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except APIError as error:
        if error.code != _RANGE_NOT_SATISFIABLE:
            raise
        counted = _counted_attributions_query(partner_id, shoutout).limit(1).execute()
        return [], int(counted.count or 0)
    return [AttributionRow.model_validate(row) for row in db.rows(result)], int(result.count or 0)


def find_attribution(user_id: str) -> AttributionRow | None:
    """The attribution for one vendor (each vendor has at most one: `user_id` is the key)."""
    result = (
        db.service_client()
        .table("referral_attributions")
        .select(_ATTRIBUTION_COLUMNS)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return AttributionRow.model_validate(row) if row else None


def set_shoutout(user_id: str, *, completed: bool, completed_at: str | None) -> bool:
    """Record whether the partner has been thanked for this vendor. False when no attribution exists."""
    result = (
        db.service_client()
        .table("referral_attributions")
        .update({"shoutout_completed": completed, "shoutout_completed_at": completed_at})
        .eq("user_id", user_id)
        .execute()
    )
    return db.first(result) is not None


def insert_attribution(values: dict[str, Any]) -> bool:
    """Attribute a vendor to a partner. False if the vendor already has one (first touch wins)."""
    try:
        db.service_client().table("referral_attributions").insert(values).execute()
    except APIError as error:
        if error.code == _UNIQUE_VIOLATION:
            return False
        raise
    return True


def list_signup_vendors(user_ids: list[str]) -> list[SignupVendorRow]:
    """The vendor profiles of the given users (users without one are absent)."""
    if not user_ids:
        return []
    result = (
        db.service_client()
        .table("vendors")
        .select("user_id,status,approval_status,payload")
        .in_("user_id", user_ids)
        .execute()
    )
    return [SignupVendorRow.model_validate(row) for row in db.rows(result)]


# --- vendor client codes -----------------------------------------------------------------------

_VENDOR_CODE_COLUMNS = "user_id,approval_status,client_referral_code,client_referral_enabled"


def find_vendor_code_settings(vendor_user_id: str) -> VendorCodeRow | None:
    """A vendor's referral settings, or `None` when they have no vendor profile."""
    result = (
        db.service_client()
        .table("vendors")
        .select(_VENDOR_CODE_COLUMNS)
        .eq("user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return VendorCodeRow.model_validate(row) if row else None


def find_vendor_by_code(code: str) -> VendorCodeRow | None:
    """The vendor that owns a (normalised) client code today, if any."""
    result = (
        db.service_client()
        .table("vendors")
        .select(_VENDOR_CODE_COLUMNS)
        .eq("client_referral_code", code)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return VendorCodeRow.model_validate(row) if row else None


def code_owners(codes: set[str]) -> dict[str, str]:
    """Map each (normalised) code to the vendor that owns it today; unowned codes are absent."""
    if not codes:
        return {}
    result = (
        db.service_client()
        .table("vendors")
        .select("user_id,client_referral_code")
        .in_("client_referral_code", sorted(codes))
        .execute()
    )
    return {
        str(row["client_referral_code"]): str(row.get("user_id") or "")
        for row in db.rows(result)
        if row.get("client_referral_code")
    }


def code_taken_by_another_vendor(code: str, vendor_user_id: str) -> bool:
    """True when a vendor other than `vendor_user_id` owns `code`."""
    result = (
        db.service_client()
        .table("vendors")
        .select("user_id")
        .eq("client_referral_code", code)
        .neq("user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    return db.first(result) is not None


def save_vendor_code(vendor_user_id: str, code: str) -> bool:
    """Give a vendor their code. False when another vendor claimed it first (the column is unique)."""
    try:
        (
            db.service_client()
            .table("vendors")
            .update({"client_referral_code": code})
            .eq("user_id", vendor_user_id)
            .execute()
        )
    except APIError as error:
        if error.code == _UNIQUE_VIOLATION:
            return False
        raise
    return True


# The vendor referral screen lists at most this many bookings.
REFERRAL_BOOKINGS_LIMIT = 200


def list_referral_bookings(vendor_user_id: str) -> list[ReferralBookingRow]:
    """The vendor's bookings made with any referral code (retired ones too), most recent first."""
    result = (
        db.service_client()
        .table("booking_requests")
        .select(
            "id,status,payment_status,event_name,event_date,created_at,client_user_id,vendor_user_id,"
            "line_items,vendor_adjustments,vendor_referral_code,service_fee_percent,referral_fee_discount_gbp"
        )
        .eq("vendor_user_id", vendor_user_id)
        .not_.is_("vendor_referral_code", "null")
        .order("updated_at", desc=True)
        .order("created_at", desc=True)
        .order("id", desc=True)
        .limit(REFERRAL_BOOKINGS_LIMIT)
        .execute()
    )
    return [ReferralBookingRow.model_validate(row) for row in db.rows(result)]
