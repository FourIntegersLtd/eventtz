"""Database access for vendor profiles (the `vendors` table). The only file here that queries tables."""

from __future__ import annotations

from typing import Any

from postgrest.exceptions import APIError
from postgrest.types import CountMethod

from app.core import db
from app.features.vendors.models import VendorRow

_VENDOR_COLUMNS = (
    "id,user_id,status,approval_status,current_step,payload,created_at,updated_at,"
    "stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled,listing_override,listing_override_reason"
)
_UNIQUE_VIOLATION = "23505"
# Search matches are capped so a one-letter search cannot pull the whole table.
SEARCH_MATCH_LIMIT = 500


def get_vendor(user_id: str) -> VendorRow | None:
    """The user's vendor row, or `None` when they have not started onboarding."""
    row = db.first(
        db.service_client().table("vendors").select(_VENDOR_COLUMNS).eq("user_id", user_id).limit(1).execute()
    )
    return VendorRow.model_validate(row) if row else None


def _is_business_name_clash(error: APIError) -> bool:
    """True when the write broke the unique index on `business_name_normalized`."""
    return error.code == _UNIQUE_VIOLATION and "business_name_normalized" in str(error)


def save_profile(user_id: str, columns: dict[str, Any], *, exists: bool) -> bool:
    """Insert or update the vendor's row; False when another vendor took the business name meanwhile."""
    table = db.service_client().table("vendors")
    try:
        if exists:
            table.update(columns).eq("user_id", user_id).execute()
        else:
            table.insert({**columns, "user_id": user_id}).execute()
    except APIError as error:
        if _is_business_name_clash(error):
            return False
        raise
    return True


def update_vendor(user_id: str, changes: dict[str, Any]) -> None:
    """Apply `changes` (column → value) to the vendor's row."""
    db.service_client().table("vendors").update(changes).eq("user_id", user_id).execute()


def business_name_owner(normalized_name: str, *, exclude_user_id: str | None) -> str | None:
    """The user id of the vendor (other than `exclude_user_id`) already using this normalised name."""
    query = (
        db.service_client()
        .table("vendors")
        .select("user_id")
        .eq("business_name_normalized", normalized_name)
        .limit(1)
    )
    if exclude_user_id:
        query = query.neq("user_id", exclude_user_id)
    row = db.first(query.execute())
    return str(row["user_id"]) if row and row.get("user_id") else None


def vendor_ids_with_business_name_like(pattern: str) -> list[str]:
    """Vendors whose normalised business name matches the ILIKE `pattern`."""
    result = (
        db.service_client()
        .table("vendors")
        .select("user_id")
        .ilike("business_name_normalized", pattern)
        .limit(SEARCH_MATCH_LIMIT)
        .execute()
    )
    return [str(row["user_id"]) for row in db.rows(result) if row.get("user_id")]


def list_vendors(
    *,
    offset: int,
    limit: int,
    user_ids: list[str] | None,
    approval_status: str | None,
    status: str | None,
) -> tuple[list[VendorRow], int]:
    """One page of vendors, most recently updated first, and how many match in total."""
    query = (
        db.service_client()
        .table("vendors")
        .select(_VENDOR_COLUMNS, count=CountMethod.exact)
        .order("updated_at", desc=True)
        .order("created_at", desc=True)
        .order("id", desc=True)
    )
    if user_ids is not None:
        query = query.in_("user_id", user_ids)
    if approval_status:
        query = query.eq("approval_status", approval_status)
    if status:
        query = query.eq("status", status)
    result = query.range(offset, offset + limit - 1).execute()
    found = [VendorRow.model_validate(row) for row in db.rows(result)]
    return found, int(result.count or len(found))
