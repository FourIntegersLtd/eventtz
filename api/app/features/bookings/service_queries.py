"""The bookings lists and the booking detail, for the vendor and for the client.

Every view prices the booking afresh from its stored lines (`service_pricing`), and
hides the other party's email and phone until the client has paid (and then only
what that party chose to share).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.features.bookings import (
    domain,
    domain_cancellation,
    domain_payments,
    domain_policy,
    repository,
    service_pricing,
)
from app.features.bookings.errors import BookingNotFound, InvalidListGroup
from app.features.bookings.rows import BookingRow, ClientReviewRow, VendorReviewRow
from app.features.bookings.schemas import (
    CancellationPreview,
    ClientBookingDetail,
    ClientBookingListItem,
    ClientReviewSummary,
    VendorBookingDetail,
    VendorBookingListItem,
    VendorReviewSummary,
)
from app.features.bookings.service_common import link_notes_thread, require_booking_id
from app.features.identity import service as identity
from app.features.identity import service_settings as identity_settings
from app.features.marketplace import service_explore
from app.features.planner import service_bookings as planner
from app.features.pricing import service as pricing
from app.features.vendors import service_listing, service_profile

# Shown for a vendor whose profile is gone.
_UNKNOWN_VENDOR_NAME = "Vendor"


def _list_filter(raw_value: str | None) -> str | None:
    """A list query filter as stored (trimmed, lower case); blank means no filter."""
    return (raw_value or "").strip().lower() or None


def _group_statuses(group: str) -> tuple[str, ...] | None:
    """The statuses a list group shows; an unknown group is refused."""
    normalised = group.strip().lower()
    if normalised not in domain.LIST_GROUP_STATUSES:
        raise InvalidListGroup()
    return domain.LIST_GROUP_STATUSES[normalised]


def _vendor_review_view(review: VendorReviewRow, emails: dict[str, str | None]) -> VendorReviewSummary:
    """A client's review as the vendor sees it, the reviewer named from their email."""
    return VendorReviewSummary(
        id=review.id,
        rating=domain.clamped_rating(review.rating),
        body=review.body or "",
        created_at=review.created_at,
        reviewer_display=service_explore.reviewer_display(emails.get(review.client_user_id or "")),
        image_urls=domain.review_image_urls(review.image_urls),
    )


def _client_review_view(review: ClientReviewRow) -> ClientReviewSummary:
    """The client's own review of the booking."""
    return ClientReviewSummary(
        id=review.id,
        rating=int(review.rating or 0),
        body=review.body or "",
        created_at=review.created_at,
        image_urls=domain.review_image_urls(review.image_urls),
    )


async def _vendor_review_views(
    session: AsyncSession, vendor_user_id: str, booking_ids: list[str]
) -> dict[str, VendorReviewSummary]:
    """The visible client review of each booking, keyed by booking id."""
    reviews = await repository.vendor_reviews(session, vendor_user_id, booking_ids)
    reviewer_ids = [review.client_user_id for review in reviews.values() if review.client_user_id]
    emails = await identity.emails_by_id(session, reviewer_ids) if reviewer_ids else {}
    return {booking_id: _vendor_review_view(review, emails) for booking_id, review in reviews.items()}


def _list_client_total(breakdown: pricing.PricingBreakdown) -> str | None:
    """The client total a list row shows; none while a package is priced on request."""
    return None if breakdown.has_pricing_tbc else breakdown.client_total_label


def _shared_detail_fields(
    booking: BookingRow, breakdown: pricing.PricingBreakdown, owners: dict[str, str]
) -> dict[str, Any]:
    """The detail fields both parties see: the event, the lines, the price and completion."""
    release_at = domain.payout_auto_release_at(
        booking, hours_after_event=get_settings().booking_payout_auto_release_hours_after_event
    )
    initial_label = domain.initial_total_label(
        booking,
        initial_client_total_label=service_pricing.initial_breakdown_for(booking, owners).client_total_label,
        current_client_total_label=breakdown.client_total_label,
    )
    return {
        "id": booking.id,
        "status": booking.status,
        "event_name": booking.event_name,
        "event_date": booking.event_date[:10],
        "event_end_date": booking.event_end_date[:10] if booking.event_end_date else None,
        "event_postcode": (booking.event_postcode or "").strip() or None,
        "event_address": (booking.event_address or "").strip() or None,
        "notes": booking.notes,
        "total_label": booking.total_label,
        "selected_option_ids": booking.selected_option_ids,
        "line_items": [line for line in booking.line_items if isinstance(line, dict)],
        "vendor_adjustments": service_pricing.adjustments_view(breakdown),
        "pricing": service_pricing.pricing_view(breakdown, booking),
        "initial_client_total_label": initial_label or None,
        "created_at": booking.created_at,
        "paid_at": booking.paid_at,
        "payment_status": booking.payment_status,
        "client_completion_confirmed_at": booking.client_completion_confirmed_at,
        "vendor_completion_confirmed_at": booking.vendor_completion_confirmed_at,
        "payout_auto_release_at": release_at.isoformat() if release_at is not None else None,
        "completion_waiting_on": domain.completion_waiting_on(booking),
        "initiator": booking.initiator,
        "conversation_id": booking.conversation_id,
        **terms_fields(booking),
    }


def _iso(moment: datetime | None) -> str | None:
    """An instant as ISO 8601 text, or None."""
    return moment.isoformat() if moment is not None else None


def terms_fields(booking: BookingRow) -> dict[str, Any]:
    """The `BookingTermsFields` both parties see: payment deadline, split payout, date move, deposit."""
    settings = get_settings()
    now = datetime.now(UTC)
    payment_due = domain_policy.booking_payment_due_at(
        booking, deadline_hours=settings.booking_payment_deadline_hours, terms_version=settings.terms_version
    )
    is_split = bool(booking.payout_upfront_percent)
    return {
        "payment_due_at": _iso(payment_due),
        "report_window_hours": booking.report_window_hours,
        "payout_upfront_percent": booking.payout_upfront_percent,
        "delivery_deadline_days": booking.delivery_deadline_days,
        "upfront_amount_gbp": booking.upfront_amount_gbp,
        "upfront_payout_at": booking.upfront_payout_at,
        "delivery_confirmed_at": booking.delivery_confirmed_at,
        "delivery_due_at": _iso(domain_policy.delivery_due_at(booking)),
        "payout_stage": domain_policy.payout_stage(booking, now) if is_split else None,
        "proposed_event_date": (booking.proposed_event_date or "")[:10] or None,
        "proposed_event_end_date": (booking.proposed_event_end_date or "")[:10] or None,
        "date_change_requested_by": booking.date_change_requested_by,
        "date_change_requested_at": booking.date_change_requested_at,
        "date_change_note": booking.date_change_note,
        "damage_deposit_gbp": booking.damage_deposit_gbp or None,
        "deposit_refund_due_at": _iso(domain_policy.deposit_refund_due_at(booking)),
        "deposit_refunded_at": booking.deposit_refunded_at,
        "deposit_claim_gbp": booking.deposit_claim_gbp,
        "deposit_claim_note": booking.deposit_claim_note,
        "deposit_claimed_at": booking.deposit_claimed_at,
        "deposit_claim_awarded_gbp": booking.deposit_claim_awarded_gbp,
        "deposit_claim_resolved_at": booking.deposit_claim_resolved_at,
    }


async def _backfilled_thread(session: AsyncSession, booking: BookingRow) -> str | None:
    """The booking's thread, after making sure a client request's notes were posted in it."""
    if booking.initiator != "client" or not (booking.notes or "").strip():
        return booking.conversation_id
    return await link_notes_thread(session, booking) or booking.conversation_id


# --- vendor ------------------------------------------------------------------------------------------


async def vendor_bookings(
    session: AsyncSession,
    vendor_user_id: str,
    *,
    group: str,
    status: str | None,
    payment_status: str | None,
    exclude_payment_status: str | None,
) -> list[VendorBookingListItem]:
    """The vendor's bookings in the group, latest activity first; client emails hidden until paid."""
    bookings = domain.recent_first(
        await repository.list_bookings(
            session,
            vendor_user_id=vendor_user_id,
            statuses=_group_statuses(group),
            status=_list_filter(status),
            payment_status=_list_filter(payment_status),
            exclude_payment_status=_list_filter(exclude_payment_status),
        )
    )
    client_ids = list({booking.client_user_id for booking in bookings})
    emails = await identity.contact_emails(session, client_ids)
    names = await identity.client_display_names(session, client_ids)
    owners = await service_pricing.code_owners_for(session, bookings)
    reviews = await _vendor_review_views(session, vendor_user_id, [booking.id for booking in bookings])
    return [
        VendorBookingListItem.model_validate(
            {
                "id": booking.id,
                "status": booking.status,
                "event_name": booking.event_name,
                "event_date": booking.event_date[:10],
                "event_end_date": booking.event_end_date[:10] if booking.event_end_date else None,
                "total_label": booking.total_label,
                "client_email": (
                    emails.get(booking.client_user_id)
                    if domain.contact_unlocked(booking.payment_status)
                    else None
                ),
                "client_display_name": names.get(booking.client_user_id),
                "created_at": booking.created_at,
                "updated_at": booking.updated_at,
                "client_total_label": _list_client_total(service_pricing.breakdown_for(booking, owners)),
                "review": reviews.get(booking.id),
                "initiator": booking.initiator,
                "conversation_id": booking.conversation_id,
                "payment_status": booking.payment_status,
                "has_price_update": domain.price_confirmation_required(booking),
                "completion_waiting_on": domain.completion_waiting_on(booking),
                "vendor_completion_confirmed_at": booking.vendor_completion_confirmed_at,
                "event_id": booking.event_id,
                "event_title": booking.event_name if booking.event_id else None,
            }
        )
        for booking in bookings
    ]


async def vendor_booking_detail(
    session: AsyncSession, vendor_user_id: str, booking_id: str
) -> VendorBookingDetail:
    """One of the vendor's bookings, with the client's contact details once shareable."""
    booking = await repository.get_booking(
        session, require_booking_id(booking_id), vendor_user_id=vendor_user_id
    )
    if booking is None:
        raise BookingNotFound()
    owners = await service_pricing.code_owners_for(session, [booking])
    client_id = booking.client_user_id
    email = (await identity.contact_emails(session, [client_id])).get(client_id)
    detail = _shared_detail_fields(booking, service_pricing.breakdown_for(booking, owners), owners)
    reviews = await _vendor_review_views(session, vendor_user_id, [booking.id])
    detail.update(
        client_user_id=client_id,
        client_display_name=(await identity.client_display_names(session, [client_id])).get(client_id),
        review=reviews.get(booking.id),
        conversation_id=await _backfilled_thread(session, booking),
        has_open_dispute=await repository.has_active_dispute(session, booking.id),
        client_email=None,
        counterparty_phone=None,
        cancellation_policy=booking.cancellation_policy,
        cancellation_refund_percent=booking.cancellation_refund_percent,
        cancellation_vendor_share_gbp=booking.cancellation_vendor_share_gbp,
        cancellation_payout_at=booking.cancellation_payout_at,
    )
    if domain.contact_visible(booking):
        shared = await identity_settings.contact_settings(session, client_id)
        detail["client_email"] = email if shared.share_email else None
        detail["counterparty_phone"] = (
            shared.contact_phone if shared.share_phone and shared.contact_phone else None
        )
    return VendorBookingDetail.model_validate(detail)


# --- client ------------------------------------------------------------------------------------------


async def client_bookings(
    session: AsyncSession,
    client_user_id: str,
    *,
    group: str,
    status: str | None,
    payment_status: str | None,
    exclude_payment_status: str | None,
) -> list[ClientBookingListItem]:
    """The client's bookings in the group, latest activity first."""
    bookings = domain.recent_first(
        await repository.list_bookings(
            session,
            client_user_id=client_user_id,
            statuses=_group_statuses(group),
            status=_list_filter(status),
            payment_status=_list_filter(payment_status),
            exclude_payment_status=_list_filter(exclude_payment_status),
        )
    )
    names = await service_listing.display_names(
        session, list({booking.vendor_user_id for booking in bookings})
    )
    completed_ids = [booking.id for booking in bookings if booking.status == "completed"]
    reviewed = await repository.reviewed_booking_ids(session, client_user_id, completed_ids)
    titles = await planner.event_titles(
        session, list({booking.event_id for booking in bookings if booking.event_id})
    )
    owners = await service_pricing.code_owners_for(session, bookings)
    return [
        ClientBookingListItem.model_validate(
            {
                "id": booking.id,
                "status": booking.status,
                "event_name": booking.event_name,
                "event_date": booking.event_date[:10],
                "event_end_date": booking.event_end_date[:10] if booking.event_end_date else None,
                "total_label": booking.total_label,
                "client_total_label": _list_client_total(service_pricing.breakdown_for(booking, owners)),
                "vendor_user_id": booking.vendor_user_id,
                "vendor_display_name": names.get(booking.vendor_user_id, _UNKNOWN_VENDOR_NAME),
                "created_at": booking.created_at,
                "updated_at": booking.updated_at,
                "initiator": booking.initiator,
                "conversation_id": booking.conversation_id,
                "has_review": booking.id in reviewed,
                "payment_status": booking.payment_status,
                "has_price_update": domain.price_confirmation_required(booking),
                "completion_waiting_on": domain.completion_waiting_on(booking),
                "client_completion_confirmed_at": booking.client_completion_confirmed_at,
                "event_id": booking.event_id,
                "event_title": titles.get(booking.event_id) if booking.event_id else None,
            }
        )
        for booking in bookings
    ]


async def client_booking_detail(
    session: AsyncSession, client_user_id: str, booking_id: str
) -> ClientBookingDetail:
    """One of the client's bookings, with the vendor's phone once shareable."""
    booking = await repository.get_booking(
        session, require_booking_id(booking_id), client_user_id=client_user_id
    )
    if booking is None:
        raise BookingNotFound()
    owners = await service_pricing.code_owners_for(session, [booking])
    vendor_id = booking.vendor_user_id
    titles = await planner.event_titles(session, [booking.event_id] if booking.event_id else [])
    review = await repository.client_review(session, client_user_id, booking.id)
    detail = _shared_detail_fields(booking, service_pricing.breakdown_for(booking, owners), owners)
    detail.update(
        vendor_user_id=vendor_id,
        vendor_display_name=(await service_listing.display_names(session, [vendor_id])).get(
            vendor_id, _UNKNOWN_VENDOR_NAME
        ),
        event_id=booking.event_id,
        event_title=titles.get(booking.event_id) if booking.event_id else None,
        vendor_referral_code=booking.vendor_referral_code,
        review=_client_review_view(review) if review is not None else None,
        conversation_id=await _backfilled_thread(session, booking),
        has_open_dispute=await repository.has_active_dispute(session, booking.id),
        counterparty_phone=None,
        cancellation_refund_percent=booking.cancellation_refund_percent,
        cancellation_refund_gbp=booking.cancellation_refund_gbp,
    )
    detail.update(await _cancellation_policy_fields(session, booking))
    if domain.contact_visible(booking):
        shared = await identity_settings.contact_settings(session, vendor_id)
        phone = await service_profile.listed_phone(session, vendor_id)
        detail["counterparty_phone"] = phone if shared.share_phone and phone else None
    return ClientBookingDetail.model_validate(detail)


async def _cancellation_policy_fields(session: AsyncSession, booking: BookingRow) -> dict[str, Any]:
    """The cancellation policy the client is (or would be) bound by, and a preview of cancelling now.

    A paid booking shows the preset snapshotted at checkout (NULL for bookings paid before
    presets existed, which still refund in full). An unpaid one shows the vendor's current
    preset, so the pay page can state what the client is agreeing to.
    """
    policy = booking.cancellation_policy
    if policy is None and booking.payment_status != domain_payments.PAID:
        policy = await service_profile.cancellation_policy(session, booking.vendor_user_id)
    fields: dict[str, Any] = {
        "cancellation_policy": policy,
        "cancellation_policy_label": domain_cancellation.preset_label(policy) if policy else None,
        "cancellation_policy_lines": domain_cancellation.describe_preset(policy) if policy else [],
        "cancellation_preview": None,
    }
    if booking.payment_status == domain_payments.PAID and booking.status in ("pending", "accepted"):
        fields["cancellation_preview"] = _cancellation_preview(booking)
    return fields


def _cancellation_preview(booking: BookingRow) -> CancellationPreview:
    """What a client cancel this minute would refund, and when that would next change."""
    now = datetime.now(UTC)
    settlement = domain_cancellation.settlement(booking, now)
    refund_gbp = domain_payments.pence_to_gbp(settlement.refund_pence)
    next_change = domain_cancellation.next_tier_change(booking, now)
    cooling_off_until = domain_cancellation.cooling_off_until(booking) if settlement.cooling_off else None
    return CancellationPreview(
        percent=settlement.refund_percent,
        refund_gbp=refund_gbp,
        refund_label=pricing.format_gbp(refund_gbp),
        cooling_off_until=cooling_off_until.isoformat() if cooling_off_until else None,
        next_tier_at=next_change[0].isoformat() if next_change else None,
        next_tier_percent=next_change[1] if next_change else None,
        lines=domain_cancellation.describe_preset(settlement.policy) if settlement.policy else [],
    )
