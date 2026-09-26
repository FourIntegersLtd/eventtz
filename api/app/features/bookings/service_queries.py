"""The bookings lists and the booking detail, for the vendor and for the client.

Every view prices the booking afresh from its stored lines (`service_pricing`), and
hides the other party's email and phone until the client has paid (and then only
what that party chose to share).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.features.bookings import domain, repository, service_pricing
from app.features.bookings.errors import BookingNotFound, InvalidListGroup
from app.features.bookings.rows import BookingRow, ClientReviewRow, VendorReviewRow
from app.features.bookings.schemas import (
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
        client_email=None,
        counterparty_phone=None,
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
        counterparty_phone=None,
    )
    if domain.contact_visible(booking):
        shared = await identity_settings.contact_settings(session, vendor_id)
        phone = await service_profile.listed_phone(session, vendor_id)
        detail["counterparty_phone"] = phone if shared.share_phone and phone else None
    return ClientBookingDetail.model_validate(detail)
