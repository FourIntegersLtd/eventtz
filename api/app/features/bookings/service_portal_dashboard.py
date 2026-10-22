"""Client and vendor home dashboards: counts and agenda computed on the server."""

from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.features.bookings import domain_portal_dashboard as dashboard_domain
from app.features.bookings.schemas import (
    ClientBookingListItem,
    ClientDashboardResponse,
    PortalDashboardNotificationPreview,
    VendorBookingListItem,
    VendorDashboardResponse,
)
from app.features.bookings.service_payout_ledger import vendor_held_payout_count
from app.features.bookings.service_queries import client_bookings, vendor_bookings
from app.features.notifications import service_feed

DashboardPortal = Literal["client", "vendor"]


async def _notification_preview(
    session: AsyncSession, principal: Principal, *, portal: DashboardPortal
) -> PortalDashboardNotificationPreview:
    """The newest few feed items for the home-screen bell preview."""
    items, _total = await service_feed.feed_page(session, principal, portal=portal, offset=0, limit=5)
    return PortalDashboardNotificationPreview(items=[item.model_dump(mode="json") for item in items])


async def client_dashboard(session: AsyncSession, client: Principal) -> ClientDashboardResponse:
    """Everything the client home screen needs without loading full booking lists in the browser."""
    active = await client_bookings(
        session, client.id, group="active", status=None, payment_status=None, exclude_payment_status=None
    )
    completed = await client_bookings(
        session, client.id, group="completed", status=None, payment_status=None, exclude_payment_status=None
    )
    awaiting_vendor = sum(
        1 for booking in active if booking.booking_status == "pending" and booking.initiator != "vendor"
    )
    awaiting_client = sum(
        1 for booking in active if booking.booking_status == "pending" and booking.initiator == "vendor"
    )
    upcoming_accepted = dashboard_domain.accepted_upcoming(active)
    by_date_raw = dashboard_domain.bookings_by_date(upcoming_accepted)
    bookings_by_date: dict[str, list[ClientBookingListItem]] = {
        day: [booking for booking in rows] for day, rows in by_date_raw.items()
    }
    next_booking = dashboard_domain.pick_next_upcoming(active)
    agenda = dashboard_domain.upcoming_agenda(upcoming_accepted, limit=5)
    needs_review = [booking for booking in completed if not booking.has_review]
    preview = await _notification_preview(session, client, portal="client")
    return ClientDashboardResponse(
        active_count=len(active),
        completed_count=len(completed),
        awaiting_vendor_count=awaiting_vendor,
        awaiting_client_count=awaiting_client,
        next_booking=next_booking,
        active_bookings=active,
        upcoming_agenda=agenda,
        bookings_by_date=bookings_by_date,
        needs_review=needs_review,
        notification_preview=preview,
    )


async def vendor_dashboard(session: AsyncSession, vendor: Principal) -> VendorDashboardResponse:
    """Everything the vendor home screen needs without loading full booking lists in the browser."""
    active = await vendor_bookings(
        session, vendor.id, group="active", status=None, payment_status=None, exclude_payment_status=None
    )
    pending = [booking for booking in active if booking.booking_status == "pending"]
    upcoming_accepted = dashboard_domain.accepted_upcoming(active)
    by_date_raw = dashboard_domain.bookings_by_date(upcoming_accepted)
    bookings_by_date: dict[str, list[VendorBookingListItem]] = {
        day: [booking for booking in rows] for day, rows in by_date_raw.items()
    }
    preview = await _notification_preview(session, vendor, portal="vendor")
    return VendorDashboardResponse(
        active_bookings_count=len(active),
        pending_bookings_count=len(pending),
        held_payouts_count=await vendor_held_payout_count(session, vendor.id),
        active_bookings=active,
        needs_response=pending[:3],
        upcoming_agenda=dashboard_domain.upcoming_agenda(upcoming_accepted, limit=5),
        bookings_by_date=bookings_by_date,
        notification_preview=preview,
    )
