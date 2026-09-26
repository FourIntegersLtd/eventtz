"""Creator partners: staff manage partners and their sign-ups; the sign-up page shows who referred."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.logging import get_logger
from app.features.identity import service as identity
from app.features.referrals import repository
from app.features.referrals.domain import (
    ShoutoutFilter,
    first_free_slug,
    is_valid_slug,
    looks_like_uuid,
    normalise_slug,
    partner_register_link,
    slug_base,
    vendor_explore_path,
)
from app.features.referrals.errors import (
    DisplayNameEmpty,
    DisplayNameRequired,
    InvalidSlug,
    LinkNotFound,
    NoFieldsToUpdate,
    PartnerNotCreated,
    PartnerNotFound,
    SignupNotFound,
)
from app.features.referrals.models import AttributionRow, PartnerRow, SignupVendorRow
from app.features.referrals.schemas import (
    CreateReferralPartnerRequest,
    ReferralPartnerPublicResponse,
    ReferralPartnerRow,
    ReferralSignupListResponse,
    ReferralVendorSignupRow,
    UpdateReferralPartnerRequest,
)
from app.features.staff import service as staff

log = get_logger(__name__)


def _partner_view(partner: PartnerRow) -> ReferralPartnerRow:
    """A stored partner as staff see it, with the sign-up link it shares."""
    return ReferralPartnerRow(**partner.model_dump(), referral_link=partner_register_link(partner.slug))


def _blank_to_none(text: str | None) -> str | None:
    """Trimmed text, or `None` when there is nothing left."""
    return (text or "").strip() or None


# --- staff: partners ---------------------------------------------------------------------------


def list_partners() -> list[ReferralPartnerRow]:
    """Every partner, newest first."""
    return [_partner_view(partner) for partner in repository.list_partners_newest_first()]


def create_partner(staff_id: str, body: CreateReferralPartnerRequest) -> ReferralPartnerRow:
    """Add a partner with a unique slug (`name`, then `name-2`, `name-3`, ...), switched on."""
    display_name = body.display_name.strip()
    if not display_name:
        raise DisplayNameRequired()
    base = slug_base(display_name=display_name, chosen_slug=body.slug)
    if not is_valid_slug(base):
        raise InvalidSlug()
    slug = first_free_slug(base, repository.slugs_starting_with(base))
    stored = repository.insert_partner(
        {
            "slug": slug,
            "display_name": display_name,
            "instagram_handle": _blank_to_none(body.instagram_handle),
            "notes": _blank_to_none(body.notes),
            "is_active": True,
            "created_by_admin_id": staff_id,
        }
    ) or repository.find_partner_by_slug(slug, active_only=False)
    if stored is None:
        raise PartnerNotCreated()
    staff.record_admin_action(
        admin_user_id=staff_id,
        action="referral_partner.create",
        entity_type="referral_partner",
        entity_id=stored.id,
    )
    return _partner_view(stored)


def _partner_changes(body: UpdateReferralPartnerRequest) -> dict[str, Any]:
    """The columns an edit changes. A null field means "leave alone"; blank handle or notes clear them."""
    changes: dict[str, Any] = {}
    if body.display_name is not None:
        display_name = body.display_name.strip()
        if not display_name:
            raise DisplayNameEmpty()
        changes["display_name"] = display_name
    if body.instagram_handle is not None:
        changes["instagram_handle"] = _blank_to_none(body.instagram_handle)
    if body.notes is not None:
        changes["notes"] = _blank_to_none(body.notes)
    if body.is_active is not None:
        changes["is_active"] = body.is_active
    if not changes:
        raise NoFieldsToUpdate()
    return changes


def update_partner(staff_id: str, partner_id: str, body: UpdateReferralPartnerRequest) -> ReferralPartnerRow:
    """Edit a partner's name, handle, notes or on/off switch. The slug (and so the link) never changes."""
    if not body.model_fields_set:
        raise NoFieldsToUpdate()
    changes = _partner_changes(body)
    updated = repository.update_partner(partner_id, changes) if looks_like_uuid(partner_id) else None
    if updated is None:
        raise PartnerNotFound()
    staff.record_admin_action(
        admin_user_id=staff_id,
        action="referral_partner.update",
        entity_type="referral_partner",
        entity_id=updated.id,
        details={"fields": sorted(changes)},
    )
    return _partner_view(updated)


# --- staff: sign-ups ---------------------------------------------------------------------------


def _business_name(vendor: SignupVendorRow | None) -> str | None:
    """The business name from the vendor's profile payload, or `None` when missing or blank."""
    payload = vendor.payload if vendor and isinstance(vendor.payload, dict) else {}
    business_name = payload.get("businessName")
    return _blank_to_none(str(business_name)) if business_name is not None else None


def _signup_views(attributions: list[AttributionRow]) -> list[ReferralVendorSignupRow]:
    """Attributions joined with each vendor's email and profile (two lookups for the whole page)."""
    user_ids = [attribution.user_id for attribution in attributions]
    emails = identity.emails_by_id(user_ids)
    vendors = {vendor.user_id: vendor for vendor in repository.list_signup_vendors(user_ids)}
    views = []
    for attribution in attributions:
        vendor = vendors.get(attribution.user_id)
        views.append(
            ReferralVendorSignupRow(
                user_id=attribution.user_id,
                email=emails.get(attribution.user_id),
                business_name=_business_name(vendor),
                approval_status=vendor.approval_status if vendor else None,
                onboarding_status=vendor.status if vendor else None,
                attributed_at=attribution.attributed_at,
                shoutout_completed=bool(attribution.shoutout_completed),
                shoutout_completed_at=attribution.shoutout_completed_at,
                explore_path=vendor_explore_path(attribution.user_id),
            )
        )
    return views


def list_signups(
    partner_id: str, *, shoutout: ShoutoutFilter, offset: int, limit: int
) -> ReferralSignupListResponse:
    """One page of the vendors a partner brought in, newest first, optionally by shout-out state."""
    partner = repository.find_partner(partner_id) if looks_like_uuid(partner_id) else None
    if partner is None:
        raise PartnerNotFound()
    attributions, total = repository.list_attributions_page(
        partner_id, shoutout=shoutout, offset=offset, limit=limit
    )
    return ReferralSignupListResponse(
        partner=_partner_view(partner),
        signups=_signup_views(attributions),
        total=total,
        offset=offset,
        limit=limit,
    )


def set_shoutout(staff_id: str, user_id: str, *, completed: bool) -> ReferralVendorSignupRow:
    """Mark a partner as thanked (or not) for one vendor; marking done stamps the time."""
    completed_at = datetime.now(UTC).isoformat() if completed else None
    if not looks_like_uuid(user_id) or not repository.set_shoutout(
        user_id, completed=completed, completed_at=completed_at
    ):
        raise SignupNotFound()
    attribution = repository.find_attribution(user_id)
    if attribution is None:
        raise SignupNotFound()
    staff.record_admin_action(
        admin_user_id=staff_id,
        action="referral_signup.shoutout",
        entity_type="referral_attribution",
        entity_id=user_id,
        details={"shoutout_completed": completed},
    )
    return _signup_views([attribution])[0]


# --- public and sign-up ------------------------------------------------------------------------


def _active_partner(raw_slug: str) -> PartnerRow | None:
    """The switched-on partner a link's `ref` points at, whatever its case or punctuation."""
    slug = normalise_slug(raw_slug)
    return repository.find_partner_by_slug(slug, active_only=True) if is_valid_slug(slug) else None


def public_partner(raw_slug: str) -> ReferralPartnerPublicResponse:
    """The partner named on the vendor sign-up page for a `?ref=` link."""
    partner = _active_partner(raw_slug)
    if partner is None:
        raise LinkNotFound()
    return ReferralPartnerPublicResponse(slug=partner.slug or raw_slug, display_name=partner.display_name)


def attribute_vendor_signup(user_id: str, referral_slug: str | None) -> bool:
    """Credit a new vendor to the partner whose link they used (first touch wins). Never raises.

    Called by sign-up after the account exists, so a failure here must not fail the sign-up.
    A blank `ref` credits nobody (the slug cleaner would otherwise turn it into `creator`).
    """
    if not (referral_slug or "").strip():
        return False
    slug = normalise_slug(referral_slug or "")
    try:
        partner = _active_partner(slug)
        if partner is None:
            return False
        return repository.insert_attribution(
            {
                "user_id": user_id,
                "referral_partner_id": partner.id,
                "referral_slug": slug,
                "shoutout_completed": False,
            }
        )
    except Exception:  # noqa: BLE001 - sign-up has already succeeded; log and move on
        log.exception("referral attribution failed for user %s", user_id)
        return False
