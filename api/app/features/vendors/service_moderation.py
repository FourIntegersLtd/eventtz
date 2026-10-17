"""Staff moderation of vendors: the vendor list, approval, returning for edits, nudges and listing overrides.

Every change is written to the staff audit log. Emails to vendors never fail the
action: the decision is already saved when the email is attempted.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import Mailer, Storage
from app.features.bookings import service_vendor_record
from app.features.identity import service as identity
from app.features.notifications import service as notifications
from app.features.staff import service as staff
from app.features.vendors import repository
from app.features.vendors.domain_listing_media import listing_cover_image_url, url_list, with_listing_media
from app.features.vendors.domain_profile_form import normalize_payload_fields
from app.features.vendors.domain_visibility import is_paused, listing_override_of
from app.features.vendors.errors import (
    ListingOverrideReasonRequired,
    ListingOverrideSuperAdminOnly,
    OnlyPendingToDraft,
    OnlySubmittedToDraft,
    VendorProfileNotFound,
)
from app.features.vendors.rows import VendorRow
from app.features.vendors.schemas import (
    AdminVendorApprovalResponse,
    AdminVendorListingMediaResponse,
    AdminVendorListingOverrideResponse,
    AdminVendorPauseResponse,
    AdminVendorProfileNudgeFailure,
    AdminVendorProfileNudgeResponse,
    AdminVendorRow,
    AdminVendorsListResponse,
    AdminVendorUnsubmitResponse,
    AdminVendorWarnResponse,
    VendorApprovalStatus,
    VendorListingOverride,
)
from app.features.vendors.service_profile import listing_is_visible, payouts_are_verified

# The staff routes' 404 copy has no full stop; the nudge failures' copy has one (baseline).
VENDOR_PROFILE_NOT_FOUND_ROUTE = "Vendor profile not found"
EMAIL_COULD_NOT_BE_SENT = "Email could not be sent."
NO_EMAIL_ON_FILE = "No email address on file."
# A vendor returned for edits lands on the last onboarding step, ready to resubmit.
RETURNED_FOR_EDITS_STEP = 8
# How many vendor ids a nudge's audit entry lists (the rest are only counted).
AUDITED_NUDGE_IDS = 20
# How much of the "returned for edits" note the audit entry keeps.
AUDITED_MESSAGE_CHARS = 200


def _now_iso() -> str:
    """The current UTC time to the second, as the baseline stored moderation timestamps."""
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def _business_name(vendor: VendorRow) -> str | None:
    """The vendor's business name as typed (trimmed), for emails."""
    raw_name = vendor.payload.get("businessName")
    return raw_name.strip() if isinstance(raw_name, str) else None


def _paused_until_iso(vendor: VendorRow) -> str | None:
    """The end of a pause that is still running, as ISO text; None when there is none or it has lapsed."""
    until = vendor.listing_paused_until
    return until.isoformat() if until is not None and is_paused(until) else None


async def _vendor_or_404(session: AsyncSession, user_id: str) -> VendorRow:
    """The vendor's row, or the staff routes' "not found"."""
    vendor = await repository.get_vendor(session, user_id)
    if vendor is None:
        raise VendorProfileNotFound(VENDOR_PROFILE_NOT_FOUND_ROUTE)
    return vendor


async def _email_of(session: AsyncSession, user_id: str) -> str | None:
    """The vendor's account email, if they have one."""
    return (await identity.emails_by_id(session, [user_id])).get(user_id)


# --- the vendor list -------------------------------------------------------------------------------


async def list_vendors(
    session: AsyncSession,
    *,
    offset: int,
    limit: int,
    search: str | None,
    approval_status: str | None,
    status: str | None,
) -> AdminVendorsListResponse:
    """One page of vendors, most recently updated first, optionally searched and filtered.

    `search` matches part of a vendor's email or business name, case-insensitively.
    """
    matching_ids: list[str] | None = None
    term = (search or "").strip()
    if term:
        pattern = f"%{term}%"
        found_ids = set(
            await identity.vendor_ids_with_email_like(session, pattern, limit=repository.SEARCH_MATCH_LIMIT)
        )
        found_ids.update(await repository.vendor_ids_with_business_name_like(session, pattern))
        if not found_ids:
            return AdminVendorsListResponse(offset=offset, limit=limit)
        matching_ids = sorted(found_ids)

    vendors, total = await repository.list_vendors(
        session,
        offset=offset,
        limit=limit,
        user_ids=matching_ids,
        approval_status=(approval_status or "").strip() or None,
        status=(status or "").strip() or None,
    )
    emails = await identity.emails_by_id(session, [vendor.user_id for vendor in vendors])
    cancellation_counts = await service_vendor_record.cancellation_counts(
        session, [vendor.user_id for vendor in vendors]
    )
    rows = [
        AdminVendorRow(
            id=vendor.id,
            user_id=vendor.user_id,
            email=emails.get(vendor.user_id),
            onboarding_status=vendor.status or "draft",
            approval_status=vendor.approval_status or "pending",
            current_step=vendor.current_step or 1,
            profile_form_data=vendor.payload,
            created_at=vendor.created_at,
            updated_at=vendor.updated_at,
            stripe_account_id=vendor.stripe_account_id,
            stripe_charges_enabled=bool(vendor.stripe_charges_enabled),
            stripe_payouts_enabled=bool(vendor.stripe_payouts_enabled),
            payouts_verified=payouts_are_verified(vendor),
            listing_visible=listing_is_visible(vendor),
            listing_override=listing_override_of(vendor.listing_override),
            listing_override_reason=vendor.listing_override_reason,
            listing_paused_until=_paused_until_iso(vendor),
            listing_pause_reason=vendor.listing_pause_reason if _paused_until_iso(vendor) else None,
            vendor_cancellation_count=cancellation_counts.get(vendor.user_id, 0),
            cancellation_review_flag=service_vendor_record.needs_review(
                cancellation_counts.get(vendor.user_id, 0)
            ),
        )
        for vendor in vendors
    ]
    return AdminVendorsListResponse(vendors=rows, total=total, offset=offset, limit=limit)


# --- approval ------------------------------------------------------------------------------------------


async def set_approval(
    session: AsyncSession,
    staff_member: Principal,
    user_id: str,
    approval_status: VendorApprovalStatus,
    *,
    mailer: Mailer,
    reason: str | None = None,
) -> AdminVendorApprovalResponse:
    """Approve, ban or re-queue a vendor, and email them when their state actually changed.

    The first approval stamps `approved_at`. The email is chosen from the listing flags
    after the change (live, finish payouts, or listing paused).
    """
    previous = await _vendor_or_404(session, user_id)
    previous_status = previous.approval_status or "pending"
    changes: dict[str, Any] = {"approval_status": approval_status}
    if approval_status == "approved" and previous_status != "approved":
        changes["approved_at"] = _now_iso()
    await repository.update_vendor(session, user_id, changes)
    updated = await _vendor_or_404(session, user_id)

    if previous_status != approval_status:
        await asyncio.to_thread(
            notifications.send_vendor_approval_changed,
            mailer,
            vendor_email=await _email_of(session, user_id),
            approval_status=approval_status,
            business_name=_business_name(updated),
            listing_visible=listing_is_visible(updated),
            payouts_verified=payouts_are_verified(updated),
            reason=(reason or "").strip() or None,
        )
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="vendor.approval",
        entity_type="vendor",
        entity_id=user_id,
        details={"approval_status": updated.approval_status or approval_status, "reason": reason},
    )
    return AdminVendorApprovalResponse(
        user_id=user_id, approval_status=updated.approval_status or approval_status
    )


# --- returning a profile for edits ----------------------------------------------------------------------


async def return_for_edits(
    session: AsyncSession,
    staff_member: Principal,
    user_id: str,
    *,
    send_email: bool,
    message: str | None,
    mailer: Mailer,
) -> AdminVendorUnsubmitResponse:
    """Send a submitted, still-pending profile back to draft so the vendor can edit it again."""
    vendor = await _vendor_or_404(session, user_id)
    if (vendor.status or "draft") != "submitted":
        raise OnlySubmittedToDraft()
    if (vendor.approval_status or "pending") != "pending":
        raise OnlyPendingToDraft()
    form = {**vendor.payload, "returnedForEditsAt": _now_iso()}
    await repository.update_vendor(
        session, user_id, {"status": "draft", "current_step": RETURNED_FOR_EDITS_STEP, "payload": form}
    )
    updated = await _vendor_or_404(session, user_id)

    email_sent = False
    if send_email:
        email_sent = await asyncio.to_thread(
            notifications.send_vendor_returned_for_edits,
            mailer,
            vendor_email=await _email_of(session, user_id),
            business_name=_business_name(updated),
            admin_message=message,
        )
    status = updated.status or "draft"
    details: dict[str, Any] = {"status": status, "email_sent": email_sent}
    if message:
        details["message_preview"] = message[:AUDITED_MESSAGE_CHARS]
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="vendor.unsubmit",
        entity_type="vendor",
        entity_id=user_id,
        details=details,
    )
    return AdminVendorUnsubmitResponse(user_id=user_id, status=status, email_sent=email_sent)


# --- nudges -----------------------------------------------------------------------------------------------


async def _nudge(
    session: AsyncSession,
    staff_member: Principal,
    user_ids: list[str],
    *,
    action: str,
    is_eligible: Callable[[VendorRow], bool],
    send: Callable[..., bool],
    mailer: Mailer,
) -> AdminVendorProfileNudgeResponse:
    """Email each eligible vendor once; count the ineligible and report who could not be reached.

    A failed send reads "No email address on file.": like the baseline, the mailer's
    `False` does not say whether the address was missing or delivery was switched off.
    """
    seen: set[str] = set()
    sent = 0
    skipped = 0
    failures: list[AdminVendorProfileNudgeFailure] = []
    for raw_id in user_ids:
        user_id = raw_id.strip()
        if not user_id or user_id in seen:
            continue
        seen.add(user_id)
        vendor = await repository.get_vendor(session, user_id)
        if vendor is None:
            failures.append(
                AdminVendorProfileNudgeFailure(user_id=user_id, error=VendorProfileNotFound.default_message)
            )
            continue
        if not is_eligible(vendor):
            skipped += 1
            continue
        try:
            delivered = await asyncio.to_thread(
                send,
                mailer,
                vendor_email=await _email_of(session, user_id),
                business_name=_business_name(vendor),
            )
        except Exception:
            failures.append(AdminVendorProfileNudgeFailure(user_id=user_id, error=EMAIL_COULD_NOT_BE_SENT))
            continue
        if delivered:
            sent += 1
        else:
            failures.append(AdminVendorProfileNudgeFailure(user_id=user_id, error=NO_EMAIL_ON_FILE))

    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action=action,
        entity_type="vendor",
        entity_id=None,
        details={
            "user_ids": user_ids[:AUDITED_NUDGE_IDS],
            "sent": sent,
            "skipped": skipped,
            "failure_count": len(failures),
        },
    )
    return AdminVendorProfileNudgeResponse(sent=sent, skipped=skipped, failures=failures)


def _is_unfinished_draft(vendor: VendorRow) -> bool:
    """True for a vendor who has not submitted their profile yet."""
    return (vendor.status or "draft") == "draft"


def _is_approved_without_payouts(vendor: VendorRow) -> bool:
    """True for an approved vendor whose Stripe payouts are not set up yet."""
    return (vendor.approval_status or "pending") == "approved" and not payouts_are_verified(vendor)


async def nudge_to_complete_profile(
    session: AsyncSession, staff_member: Principal, user_ids: list[str], *, mailer: Mailer
) -> AdminVendorProfileNudgeResponse:
    """Email draft vendors to finish and submit their profile."""
    return await _nudge(
        session,
        staff_member,
        user_ids,
        action="vendor.profile_nudge",
        is_eligible=_is_unfinished_draft,
        send=notifications.send_vendor_profile_nudge,
        mailer=mailer,
    )


async def nudge_to_set_up_payouts(
    session: AsyncSession, staff_member: Principal, user_ids: list[str], *, mailer: Mailer
) -> AdminVendorProfileNudgeResponse:
    """Email approved vendors who have not finished Stripe payout setup."""
    return await _nudge(
        session,
        staff_member,
        user_ids,
        action="vendor.payout_nudge",
        is_eligible=_is_approved_without_payouts,
        send=notifications.send_vendor_payout_nudge,
        mailer=mailer,
    )


# --- listing controls ----------------------------------------------------------------------------


async def set_listing_override(
    session: AsyncSession,
    staff_member: Principal,
    user_id: str,
    listing_override: VendorListingOverride,
    *,
    reason: str | None,
    mailer: Mailer,
) -> AdminVendorListingOverrideResponse:
    """Force a listing visible or hidden (super admins, with a reason), or return it to the automatic rule.

    `visible` waives the Stripe requirement for a vendor vetted another way; `hidden`
    takes a listing down without a ban. Neither lists an unapproved or banned vendor.
    Hiding emails the vendor the reason and how to appeal (a statement of reasons).
    """
    if listing_override != "auto" and not staff_member.is_super_admin:
        raise ListingOverrideSuperAdminOnly()
    clean_reason = (reason or "").strip() or None
    if listing_override != "auto" and not clean_reason:
        raise ListingOverrideReasonRequired()
    previous = await _vendor_or_404(session, user_id)
    await repository.update_vendor(
        session,
        user_id,
        {
            "listing_override": listing_override,
            "listing_override_reason": clean_reason,
            "listing_override_by": staff_member.id,
            "listing_override_at": datetime.now(UTC).isoformat(),
        },
    )
    updated = await _vendor_or_404(session, user_id)
    stored_override = listing_override_of(updated.listing_override)
    visible = listing_is_visible(updated)
    if listing_override == "hidden" and listing_override_of(previous.listing_override) != "hidden":
        await asyncio.to_thread(
            notifications.send_vendor_listing_hidden,
            mailer,
            vendor_email=await _email_of(session, user_id),
            business_name=_business_name(updated),
            reason=clean_reason or "",
        )
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="vendor.listing_override",
        entity_type="vendor",
        entity_id=user_id,
        # The reason is audited exactly as staff typed it (baseline).
        details={"listing_override": listing_override, "reason": reason, "listing_visible": visible},
    )
    return AdminVendorListingOverrideResponse(
        user_id=user_id, listing_override=stored_override, listing_visible=visible
    )


async def set_listing_media(
    session: AsyncSession,
    staff_member: Principal,
    user_id: str,
    *,
    display_order: list[str],
    hidden_image_urls: list[str],
    storage: Storage,
) -> AdminVendorListingMediaResponse:
    """Reorder or hide the vendor's listing photos without changing their own portfolio order."""
    vendor = await _vendor_or_404(session, user_id)
    form = with_listing_media(vendor.payload, display_order, hidden_image_urls)
    form = normalize_payload_fields(form, user_id, upload_host=storage.public_host())
    await repository.update_vendor(session, user_id, {"payload": form})
    updated = await _vendor_or_404(session, user_id)

    cover_url = listing_cover_image_url(updated.payload)
    stored_order = url_list(updated.payload.get("listingDisplayOrder"))
    stored_hidden = url_list(updated.payload.get("listingHiddenImageUrls"))
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="vendor.listing_media_set",
        entity_type="vendor",
        entity_id=user_id,
        details={
            "listing_cover_image_url": cover_url,
            "display_order_count": len(stored_order),
            "hidden_count": len(stored_hidden),
        },
    )
    return AdminVendorListingMediaResponse(
        user_id=user_id,
        listing_cover_image_url=cover_url,
        display_order=stored_order,
        hidden_image_urls=stored_hidden,
    )


# --- consequences: warnings and timed pauses ---------------------------------------------------------


async def warn_vendor(
    session: AsyncSession, staff_member: Principal, user_id: str, *, message: str, mailer: Mailer
) -> AdminVendorWarnResponse:
    """Email the vendor a formal warning and record it in the staff audit log."""
    vendor = await _vendor_or_404(session, user_id)
    clean_message = message.strip()
    email_sent = await asyncio.to_thread(
        notifications.send_vendor_warning,
        mailer,
        vendor_email=await _email_of(session, user_id),
        business_name=_business_name(vendor),
        message=clean_message,
    )
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="vendor.warning",
        entity_type="vendor",
        entity_id=user_id,
        details={"message": clean_message[:AUDITED_MESSAGE_CHARS], "email_sent": email_sent},
    )
    return AdminVendorWarnResponse(user_id=user_id, email_sent=email_sent)


async def pause_listing(
    session: AsyncSession,
    staff_member: Principal,
    user_id: str,
    *,
    days: int,
    reason: str,
    mailer: Mailer,
) -> AdminVendorPauseResponse:
    """Hide the vendor's listing for `days` days; it returns by itself, and the vendor is emailed why."""
    await _vendor_or_404(session, user_id)
    clean_reason = reason.strip()
    paused_until = datetime.now(UTC).replace(microsecond=0) + timedelta(days=days)
    await repository.update_vendor(
        session, user_id, {"listing_paused_until": paused_until, "listing_pause_reason": clean_reason}
    )
    updated = await _vendor_or_404(session, user_id)
    await asyncio.to_thread(
        notifications.send_vendor_listing_paused,
        mailer,
        vendor_email=await _email_of(session, user_id),
        business_name=_business_name(updated),
        reason=clean_reason,
        paused_until_label=f"{paused_until.day} {paused_until:%B %Y}",
    )
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="vendor.listing_pause",
        entity_type="vendor",
        entity_id=user_id,
        details={"days": days, "paused_until": paused_until.isoformat(), "reason": clean_reason},
    )
    return AdminVendorPauseResponse(
        user_id=user_id,
        listing_paused_until=paused_until.isoformat(),
        listing_pause_reason=clean_reason,
        listing_visible=listing_is_visible(updated),
    )


async def clear_listing_pause(
    session: AsyncSession, staff_member: Principal, user_id: str
) -> AdminVendorPauseResponse:
    """End a listing pause early."""
    await _vendor_or_404(session, user_id)
    await repository.update_vendor(
        session, user_id, {"listing_paused_until": None, "listing_pause_reason": None}
    )
    updated = await _vendor_or_404(session, user_id)
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="vendor.listing_pause_cleared",
        entity_type="vendor",
        entity_id=user_id,
        details={},
    )
    return AdminVendorPauseResponse(user_id=user_id, listing_visible=listing_is_visible(updated))
