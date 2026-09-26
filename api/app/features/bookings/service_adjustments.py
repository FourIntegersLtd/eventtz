"""A vendor's extras and discounts on a pending client request.

The new list replaces the old one. Surcharges are capped (one at a time and as a
share of the packages) and discounts cannot take the vendor's price to zero. The
client then has to confirm the new price before the vendor can accept.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer
from app.core.settings import get_settings
from app.features.bookings import domain, repository, service_pricing, service_queries
from app.features.bookings.errors import (
    AdjustmentsNotOnVendorQuote,
    AdjustmentsPendingOnly,
    BookingNotFound,
    DiscountsTooHigh,
)
from app.features.bookings.schemas import PutVendorBookingAdjustmentsBody, VendorBookingDetail
from app.features.bookings.service_common import announce_change
from app.features.notifications import service_booking as notices
from app.features.pricing import service as pricing


async def replace_adjustments(
    session: AsyncSession,
    mailer: Mailer,
    vendor_user_id: str,
    booking_id: str,
    body: PutVendorBookingAdjustmentsBody,
) -> VendorBookingDetail:
    """Store the vendor's new extras and discounts, re-price the booking and tell the client."""
    booking = await repository.get_booking(session, booking_id, vendor_user_id=vendor_user_id)
    if booking is None:
        raise BookingNotFound()
    if booking.initiator == "vendor":
        raise AdjustmentsNotOnVendorQuote()
    if booking.status != "pending":
        raise AdjustmentsPendingOnly()

    requested = domain.built_adjustments([adjustment.model_dump() for adjustment in body.adjustments])
    settings = get_settings()
    domain.check_surcharge_caps(
        booking.line_items,
        requested,
        max_single_gbp=float(settings.booking_max_adjustment_gbp),
        max_percent=float(settings.booking_max_adjustment_pct_of_subtotal),
    )
    owners = await service_pricing.code_owners_for(session, [booking])
    breakdown = service_pricing.breakdown_for(booking, owners, vendor_adjustments=requested)
    if breakdown.vendor_portion_gbp <= 0:
        raise DiscountsTooHigh()
    stored = service_pricing.adjustments_view(breakdown)

    values = {"vendor_adjustments": stored, **service_pricing.snapshot_columns(breakdown)}
    if not (booking.initial_client_total_label or "").strip():
        # Older requests have no original total stored; keep it before the price moves.
        values["initial_client_total_label"] = pricing.persisted_total_label(
            service_pricing.initial_breakdown_for(booking, owners)
        )
    changed = await repository.update_booking(
        session, booking.id, values, vendor_user_id=vendor_user_id, status_in=("pending",)
    )
    if not changed:
        raise BookingNotFound()
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="booking_pricing_updated",
        body=domain.pricing_explanation_body(
            lead_sentence="Your vendor sent an updated price for this booking.",
            total_label=service_pricing.client_total_label(breakdown),
            adjustments=stored,
        ),
    )
    announce_change(session, booking)
    return await service_queries.vendor_booking_detail(session, vendor_user_id, booking.id)
