"""Vendor client codes: a vendor sets their code, clients preview it, the vendor sees its bookings."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import service as identity
from app.features.pricing import service as pricing
from app.features.referrals import repository
from app.features.referrals.domain import (
    FEE_TIERS,
    PAID_STATUSES,
    client_share_link,
    discount_and_tier,
    normalise_client_code,
    random_client_code,
    stored_code_discount,
)
from app.features.referrals.errors import (
    CodeAllocationFailed,
    CodeFormatInvalid,
    CodeLocked,
    CodeTaken,
    ReferralCodeInvalid,
    ReferralProgrammeClosed,
    ReferralProgrammeNotFound,
)
from app.features.referrals.rows import ReferralBookingRow, VendorCodeRow
from app.features.referrals.schemas import (
    ReferralFeeTier,
    VendorClientReferralResponse,
    VendorReferralBookingRow,
    VendorReferralBookingsResponse,
    VendorReferralPreviewResponse,
    VendorReferralSetCodeResponse,
)

# How many random codes to try before giving up (a million codes, so collisions are rare).
CODE_ALLOCATION_ATTEMPTS = 50


def _tier_views() -> list[ReferralFeeTier]:
    """The discount tiers, best first, as the screens list them."""
    return [
        ReferralFeeTier(min_spend_gbp=tier.min_spend_gbp, fee_discount_gbp=tier.fee_discount_gbp)
        for tier in FEE_TIERS
    ]


async def _approved_settings(session: AsyncSession, vendor_user_id: str) -> VendorCodeRow | None:
    """The vendor's referral settings, or `None` until they have an approved profile."""
    settings = await repository.find_vendor_code_settings(session, vendor_user_id)
    return settings if settings and settings.approval_status == "approved" else None


# --- the vendor's own code ---------------------------------------------------------------------


async def referral_programme(session: AsyncSession, vendor_user_id: str) -> VendorClientReferralResponse:
    """The vendor's referral screen: their code and share link (blank until set), the fee and the tiers."""
    settings = await _approved_settings(session, vendor_user_id)
    if settings is None:
        raise ReferralProgrammeNotFound()
    code = normalise_client_code(settings.client_referral_code) or ""
    return VendorClientReferralResponse(
        referral_code=code,
        has_referral_code=bool(code),
        share_link=client_share_link(vendor_user_id, code) if code else "",
        service_fee_percent=pricing.BOOKING_SERVICE_FEE_PERCENT,
        tiers=_tier_views(),
        enabled=bool(settings.client_referral_enabled),
    )


async def _allocate_random_code(session: AsyncSession, vendor_user_id: str) -> str:
    """A random six-digit code no other vendor owns."""
    for _attempt in range(CODE_ALLOCATION_ATTEMPTS):
        candidate = random_client_code()
        if not await repository.code_taken_by_another_vendor(session, candidate, vendor_user_id):
            return candidate
    raise CodeAllocationFailed()


async def choose_code(
    session: AsyncSession, vendor_user_id: str, requested_code: str | None
) -> VendorReferralSetCodeResponse:
    """Set the vendor's code once: the one they typed (digits only), or a random one when left blank.

    A code never changes after it is set, so links already shared keep working; sending
    the existing code again is accepted and changes nothing.
    """
    settings = await _approved_settings(session, vendor_user_id)
    if settings is None:
        raise ReferralProgrammeClosed()
    wants_random = not (requested_code or "").strip()
    existing = normalise_client_code(settings.client_referral_code)
    if existing:
        if wants_random or normalise_client_code(requested_code) != existing:
            raise CodeLocked()
        return VendorReferralSetCodeResponse(
            referral_code=existing, share_link=client_share_link(vendor_user_id, existing)
        )

    if wants_random:
        code = await _allocate_random_code(session, vendor_user_id)
    else:
        chosen = normalise_client_code(requested_code)
        # `\d` also matches digits such as "１２３"; the column only accepts ASCII 0-9.
        if not chosen or not chosen.isascii():
            raise CodeFormatInvalid()
        if await repository.code_taken_by_another_vendor(session, chosen, vendor_user_id):
            raise CodeTaken()
        code = chosen
    # The column is unique, so a vendor who claims the same code a moment earlier wins.
    if not await repository.save_vendor_code(session, vendor_user_id, code):
        raise CodeTaken()
    return VendorReferralSetCodeResponse(
        referral_code=code, share_link=client_share_link(vendor_user_id, code)
    )


# --- clients previewing a code -----------------------------------------------------------------


async def _code_works_for_vendor(session: AsyncSession, vendor_user_id: str, typed_code: str) -> bool:
    """True when the code belongs to this vendor, is switched on, and the vendor is approved."""
    code = normalise_client_code(typed_code)
    owner = await repository.find_vendor_by_code(session, code) if code else None
    return bool(
        owner
        and owner.user_id == vendor_user_id.strip()
        and owner.client_referral_enabled
        and owner.approval_status == "approved"
    )


async def preview(
    session: AsyncSession, vendor_user_id: str, typed_code: str, vendor_portion_gbp: float
) -> VendorReferralPreviewResponse:
    """What a code takes off the service fee for this spend. A bad code is not an error; it saves nothing."""
    code_valid = await _code_works_for_vendor(session, vendor_user_id, typed_code)
    discount, tier_min = discount_and_tier(vendor_portion_gbp) if code_valid else (0.0, None)
    breakdown = pricing.build_pricing_breakdown(
        line_items=[{"unit_price_gbp": max(0.0, vendor_portion_gbp)}],
        vendor_adjustments=[],
        referral_fee_discount_gbp=discount,
    )
    return VendorReferralPreviewResponse(
        valid=code_valid and discount > 0,
        code_valid=code_valid,
        tiers=_tier_views(),
        service_fee_percent=pricing.BOOKING_SERVICE_FEE_PERCENT,
        qualified_discount_gbp=discount,
        tier_min_spend_gbp=tier_min,
        service_fee_before_discount_gbp=breakdown.service_fee_before_discount_gbp,
        service_fee_gbp=breakdown.service_fee_gbp,
    )


# --- bookings made with a code ----------------------------------------------------------------


async def code_for_booking(session: AsyncSession, vendor_user_id: str, typed_code: str | None) -> str | None:
    """The normalised code a new booking stores, `None` when none was typed.

    A code that was typed but does not work for this vendor fails the booking,
    so the client is never charged a fee they expected to be discounted.
    """
    if not normalise_client_code(typed_code):
        if (typed_code or "").strip():
            raise ReferralCodeInvalid()
        return None
    if not await _code_works_for_vendor(session, vendor_user_id, typed_code or ""):
        raise ReferralCodeInvalid()
    return normalise_client_code(typed_code)


async def code_owners(session: AsyncSession, codes: set[str]) -> dict[str, str]:
    """Map each (normalised) code to the vendor who owns it today; unowned codes are left out."""
    return await repository.code_owners(session, {code for code in codes if code})


def booking_code_discount(
    *, stored_code: object, booking_vendor_id: str | None, owners: dict[str, str], vendor_portion_gbp: float
) -> tuple[float, float | None]:
    """The fee discount a booking's stored code earns, and its tier minimum (see `stored_code_discount`)."""
    return stored_code_discount(
        stored_code=stored_code,
        booking_vendor_id=booking_vendor_id,
        code_owners=owners,
        vendor_portion_gbp=vendor_portion_gbp,
    )


def spend_discount(vendor_portion_gbp: float) -> tuple[float, float | None]:
    """The fee discount a valid code earns on this spend, and its tier minimum."""
    return discount_and_tier(vendor_portion_gbp)


# --- the vendor's referral bookings ------------------------------------------------------------


def _discount_saved(booking: ReferralBookingRow, owners: dict[str, str]) -> tuple[float, float]:
    """The booking's vendor portion and what its code saved the client.

    Paid bookings report the discount stored when they were paid; others are re-priced
    with today's tiers from the code stored on the booking.
    """
    discount, tier_min = stored_code_discount(
        stored_code=booking.vendor_referral_code,
        booking_vendor_id=booking.vendor_user_id,
        code_owners=owners,
        vendor_portion_gbp=pricing.vendor_portion_gbp(booking.line_items, booking.vendor_adjustments),
    )
    breakdown = pricing.build_pricing_breakdown(
        line_items=booking.line_items if isinstance(booking.line_items, list) else [],
        vendor_adjustments=booking.vendor_adjustments,
        service_fee_percent=pricing.service_fee_percent_or_default(booking.service_fee_percent),
        referral_fee_discount_gbp=discount,
        referral_tier_min_spend_gbp=tier_min,
    )
    saved = breakdown.referral_fee_discount_gbp
    if (
        booking.payment_status or "unpaid"
    ) in PAID_STATUSES and booking.referral_fee_discount_gbp is not None:
        try:
            saved = float(booking.referral_fee_discount_gbp)
        except (TypeError, ValueError):
            saved = breakdown.referral_fee_discount_gbp
    return breakdown.vendor_portion_gbp, saved


async def _referral_booking_rows(
    session: AsyncSession, bookings: list[ReferralBookingRow]
) -> tuple[list[VendorReferralBookingRow], float]:
    """Map stored referral bookings to API rows and sum client savings."""
    filtered = [booking for booking in bookings if (booking.vendor_referral_code or "").strip()]
    stored_codes = {normalise_client_code(booking.vendor_referral_code) for booking in filtered}
    owners = await repository.code_owners(session, {code for code in stored_codes if code})
    client_names = await identity.client_display_names(
        session, [booking.client_user_id for booking in filtered if booking.client_user_id]
    )
    views: list[VendorReferralBookingRow] = []
    total_saved = 0.0
    for booking in filtered:
        vendor_portion, saved = _discount_saved(booking, owners)
        total_saved += saved
        views.append(
            VendorReferralBookingRow(
                booking_request_id=booking.id,
                event_name=booking.event_name or "",
                event_date=(booking.event_date or "")[:10],
                booking_status=booking.status or "",
                payment_status=booking.payment_status or "unpaid",
                vendor_portion_gbp=vendor_portion,
                referral_fee_discount_gbp=round(saved, 2),
                referral_code=(booking.vendor_referral_code or "").strip(),
                client_display_name=client_names.get(booking.client_user_id or ""),
                created_at=booking.created_at if isinstance(booking.created_at, str) else None,
            )
        )
    return views, total_saved


async def referral_bookings(session: AsyncSession, vendor_user_id: str) -> VendorReferralBookingsResponse:
    """Every booking made with the vendor's codes (current or retired), and the clients' total savings."""
    response = await referral_bookings_page(
        session, vendor_user_id, offset=0, limit=repository.REFERRAL_BOOKINGS_LIMIT
    )
    return response


async def referral_bookings_page(
    session: AsyncSession, vendor_user_id: str, *, offset: int, limit: int
) -> VendorReferralBookingsResponse:
    """One page of referral bookings plus aggregate totals."""
    page_bookings, total = await repository.list_referral_bookings_page(
        session, vendor_user_id, offset=offset, limit=limit
    )
    all_bookings = await repository.list_referral_bookings(session, vendor_user_id)
    _all_views, total_saved = await _referral_booking_rows(session, all_bookings)
    views, _page_saved = await _referral_booking_rows(session, page_bookings)
    return VendorReferralBookingsResponse(
        total_referral_bookings=total,
        accepted_total=await repository.count_accepted_referral_bookings(session, vendor_user_id),
        total_fee_savings_gbp=round(total_saved, 2),
        bookings=views,
        total=total,
        offset=offset,
        limit=limit,
    )
