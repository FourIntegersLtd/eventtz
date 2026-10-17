"""The vendor's own profile: load it, check a business name, save a step, submit for review."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import Mailer, Storage
from app.features.identity import service as identity
from app.features.notifications import service as notifications
from app.features.vendors import repository
from app.features.vendors.domain_insurance import insurance_status
from app.features.vendors.domain_profile_form import (
    business_name_from_payload,
    explore_search_patch_from_payload,
    normalize_business_name,
    normalize_cancellation_policy,
    normalize_payload_fields,
    validate_payload_for_progress,
    with_clamped_bio,
)
from app.features.vendors.domain_visibility import is_publicly_listable, listing_override_of, payouts_verified
from app.features.vendors.errors import BusinessNameTaken
from app.features.vendors.rows import VendorRow
from app.features.vendors.schemas import VendorInsuranceState, VendorProfilePutBody, VendorProfileState


def _today() -> date:
    """The UTC date: insurance runs by whole days."""
    return datetime.now(UTC).date()


def insurance_state(vendor: VendorRow, *, today: date | None = None) -> VendorInsuranceState:
    """The vendor's cover as staff see it."""
    day = today or _today()
    raw_certificate = vendor.payload.get("indemnityCertNamePersisted")
    certificate_url = raw_certificate.strip() or None if isinstance(raw_certificate, str) else None
    return VendorInsuranceState(
        status=insurance_status(
            certificate_url=certificate_url,
            verified_certificate_url=vendor.insurance_certificate_url,
            expires_on=vendor.insurance_expires_on,
            today=day,
        ),
        certificate_url=certificate_url,
        verified_certificate_url=vendor.insurance_certificate_url,
        expires_on=vendor.insurance_expires_on,
        cover_gbp=vendor.insurance_cover_gbp,
        verified_at=vendor.insurance_verified_at,
    )


def payouts_are_verified(vendor: VendorRow) -> bool:
    """True when the vendor's Stripe account can both take charges and pay out."""
    return payouts_verified(
        stripe_account_id=vendor.stripe_account_id,
        charges_enabled=bool(vendor.stripe_charges_enabled),
        payouts_enabled=bool(vendor.stripe_payouts_enabled),
    )


def listing_is_visible(vendor: VendorRow) -> bool:
    """True when clients can find the vendor on the marketplace right now."""
    return is_publicly_listable(
        approval_status=vendor.approval_status or "pending",
        listing_override=vendor.listing_override,
        payouts_ready=payouts_are_verified(vendor),
        paused_until=vendor.listing_paused_until,
    )


async def payouts_ready_for_bookings(session: AsyncSession, vendor_user_id: str) -> bool:
    """True when the vendor may accept a booking: Stripe can pay them, or staff forced them visible."""
    vendor = await repository.get_vendor(session, vendor_user_id)
    if vendor is None:
        return False
    return listing_override_of(vendor.listing_override) == "visible" or payouts_are_verified(vendor)


async def payout_route_ready(session: AsyncSession, vendor_user_id: str) -> bool:
    """True when Stripe can pay the vendor: a connected account with payouts switched on.

    Stricter than `payouts_ready_for_bookings`: a staff listing override lets a vendor
    accept bookings, but money can only move once Stripe itself can pay them.
    """
    vendor = await repository.get_vendor(session, vendor_user_id)
    return bool(vendor and vendor.stripe_account_id and vendor.stripe_payouts_enabled)


async def cancellation_policy(session: AsyncSession, vendor_user_id: str) -> str:
    """The vendor's current cancellation preset key (`flexible` when they have not chosen one).

    Bookings snapshot this at checkout (`bookings.domain_cancellation`); this is for screens
    shown before payment, so the client knows what they are agreeing to.
    """
    vendor = await repository.get_vendor(session, vendor_user_id)
    raw_policy = vendor.payload.get("cancellationPolicy") if vendor is not None else None
    return normalize_cancellation_policy(raw_policy if isinstance(raw_policy, str) else "")


async def listed_phone(session: AsyncSession, vendor_user_id: str) -> str | None:
    """The phone number on the vendor's profile form, or `None` when there is none."""
    vendor = await repository.get_vendor(session, vendor_user_id)
    phone = vendor.payload.get("phone") if vendor is not None else None
    return phone.strip() or None if isinstance(phone, str) else None


def _profile_state(vendor: VendorRow) -> VendorProfileState:
    """The profile screen's view of a stored vendor row."""
    return VendorProfileState(
        current_step=vendor.current_step or 1,
        onboarding_status=vendor.status or "draft",
        approval_status=vendor.approval_status or "pending",
        profile_form_data=vendor.payload,
        updated_at=vendor.updated_at,
        payouts_verified=payouts_are_verified(vendor),
        listing_visible=listing_is_visible(vendor),
        listing_override=listing_override_of(vendor.listing_override),
        insurance=insurance_state(vendor),
    )


async def get_profile_state(session: AsyncSession, principal: Principal) -> VendorProfileState:
    """The caller's profile, or a blank step-1 draft when they have not started onboarding.

    Any signed-in account may call this (baseline behaviour); a client simply gets the blank draft.
    """
    vendor = await repository.get_vendor(session, principal.id)
    if vendor is None:
        return VendorProfileState(current_step=1, onboarding_status="draft", approval_status="pending")
    return _profile_state(vendor)


async def is_business_name_available(session: AsyncSession, principal: Principal, business_name: str) -> bool:
    """True when no other vendor uses this name (case and repeated spaces ignored). Blank counts as free."""
    normalized = normalize_business_name(business_name)
    if not normalized:
        return True
    owner = await repository.business_name_owner(session, normalized, exclude_user_id=principal.id)
    return owner is None


async def save_profile(
    session: AsyncSession,
    principal: Principal,
    body: VendorProfilePutBody,
    *,
    storage: Storage,
    mailer: Mailer,
) -> VendorProfileState:
    """Merge a save of the onboarding form into the stored one, check it, and store it.

    Moving forward checks the steps just finished; submitting checks every step and
    tells staff there is a profile to review. Saving also makes the caller a vendor
    account, whatever they were before (baseline behaviour).
    """
    existing = await repository.get_vendor(session, principal.id)
    previous_step = (existing.current_step or 1) if existing else 1
    previous_status = (existing.status or "draft") if existing else "draft"

    merged_form = {**(existing.payload if existing else {}), **with_clamped_bio(body.profile_form_data)}
    merged_form = normalize_payload_fields(merged_form, principal.id, upload_host=storage.public_host())
    status = body.onboarding_status or (existing.status if existing else None) or "draft"
    if status == "submitted":
        merged_form.pop("returnedForEditsAt", None)
    validate_payload_for_progress(
        current_step=body.current_step, previous_step=previous_step, payload=merged_form, status=status
    )

    business_name = business_name_from_payload(merged_form)
    if business_name and await repository.business_name_owner(
        session, business_name, exclude_user_id=principal.id
    ):
        raise BusinessNameTaken()

    await identity.mark_as_vendor(session, principal.id)
    columns = {
        "current_step": body.current_step,
        "payload": merged_form,
        "status": status,
        **explore_search_patch_from_payload(merged_form),
    }
    if not await repository.save_profile(session, principal.id, columns, exists=existing is not None):
        # Another vendor took the name between the check above and the write.
        raise BusinessNameTaken()

    saved = await repository.get_vendor(session, principal.id)
    if saved is None:
        raise RuntimeError("vendor profile save returned no row")
    if status == "submitted" and previous_status != "submitted":
        raw_name = merged_form.get("businessName")
        await asyncio.to_thread(
            notifications.send_vendor_submitted_alert,
            mailer,
            vendor_user_id=principal.id,
            vendor_email=principal.email,
            business_name=raw_name.strip() if isinstance(raw_name, str) else None,
        )
    return _profile_state(saved)
