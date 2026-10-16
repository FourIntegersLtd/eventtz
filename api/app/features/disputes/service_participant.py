"""Use cases for a client or vendor opening, listing, and fetching their own disputes."""

from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid
from app.core.events import publish_after_commit, user_topic
from app.core.logging import get_logger
from app.core.ports import Mailer
from app.features.disputes import domain, repository
from app.features.disputes.errors import (
    BookingNotFound,
    CannotOpenDispute,
    DisputeAlreadyOpen,
    DisputeNotFoundForParticipant,
    InvalidBookingId,
    InvalidDisputeId,
)
from app.features.disputes.rows import DisputeBookingRow, DisputeRow
from app.features.disputes.schemas import DisputePublic
from app.features.identity import service as identity
from app.features.notifications import service as notifications
from app.features.vendors import service_listing as vendor_listing

Party = Literal["client", "vendor"]

log = get_logger(__name__)


async def _require_booking(session: AsyncSession, booking_id: str) -> DisputeBookingRow:
    """The booking, or raise the id-shaped or not-found error opening a dispute needs."""
    if as_uuid(booking_id) is None:
        raise InvalidBookingId()
    booking = await repository.get_booking(session, booking_id)
    if booking is None:
        raise BookingNotFound()
    return booking


async def open_dispute(
    session: AsyncSession, mailer: Mailer, *, user_id: str, booking_id: str, summary: str
) -> DisputePublic:
    """A party opens a dispute on their own booking, in an allowed status, with none already active.

    BASELINE QUIRK: a booking that exists but belongs to someone else answers 403
    (`CannotOpenDispute`), unlike the listing routes below, which hide it instead.
    """
    booking = await _require_booking(session, booking_id)
    if not domain.user_is_booking_party(user_id, booking):
        raise CannotOpenDispute()
    domain.check_booking_allows_new_dispute(booking)
    if await repository.has_active_dispute(session, booking_id):
        raise DisputeAlreadyOpen()
    pair_conversation_id = None
    if booking.conversation_id is None:
        pair_conversation_id = await repository.lookup_pair_conversation_id(
            session, client_user_id=booking.client_user_id, vendor_user_id=booking.vendor_user_id
        )
    conversation_id = domain.resolve_conversation_id(booking, pair_conversation_id=pair_conversation_id)
    dispute = await repository.insert_dispute(
        session,
        booking_request_id=booking_id,
        opened_by_user_id=user_id,
        summary=summary,
        conversation_id=conversation_id,
    )
    # Both parties' screens refresh; the event is sent only if the request commits.
    for party_user_id in (booking.client_user_id, booking.vendor_user_id):
        publish_after_commit(session, user_topic(party_user_id), domain.DISPUTE_CHANGED)
    try:
        opener_emails = await identity.emails_by_id(session, [user_id])
        notifications.send_dispute_opened_alert(
            mailer,
            booking_id=booking_id,
            dispute_id=dispute.id,
            summary=summary,
            opened_by_email=opener_emails.get(user_id),
        )
    except Exception:
        log.warning("admin dispute email failed booking=%s", booking_id, exc_info=True)
    return await _to_public(session, dispute, booking=booking, viewer_user_id=user_id)


async def list_disputes_on_booking(
    session: AsyncSession, *, user_id: str, booking_id: str
) -> list[DisputePublic]:
    """Disputes on this booking, or an empty list when the caller isn't a party (hides existence)."""
    if as_uuid(booking_id) is None:
        raise InvalidBookingId()
    booking = await repository.get_booking(session, booking_id)
    if booking is None or not domain.user_is_booking_party(user_id, booking):
        return []
    disputes = await repository.list_disputes_on_booking(session, booking_id)
    return [
        await _to_public(session, dispute, booking=booking, viewer_user_id=user_id) for dispute in disputes
    ]


async def list_own_disputes(session: AsyncSession, user_id: str) -> list[DisputePublic]:
    """Every dispute on a booking this user is a party to, most recently opened first."""
    disputes = domain.recent_first(await repository.list_disputes_for_party(session, user_id))
    bookings = await _bookings_by_id(session, [dispute.booking_request_id for dispute in disputes])
    public_disputes = []
    for dispute in disputes:
        booking = bookings.get(dispute.booking_request_id)
        if booking is not None:
            public_disputes.append(
                await _to_public(session, dispute, booking=booking, viewer_user_id=user_id)
            )
    return public_disputes


async def get_dispute(session: AsyncSession, *, user_id: str, dispute_id: str) -> DisputePublic:
    """One dispute, if the caller is a party to its booking; hides existence otherwise (404).

    Unlike opening a dispute, a non-party here gets the same not-found answer as a
    dispute id that doesn't exist at all.
    """
    if as_uuid(dispute_id) is None:
        raise InvalidDisputeId()
    dispute = await repository.get_dispute(session, dispute_id)
    if dispute is None:
        raise DisputeNotFoundForParticipant()
    booking = await repository.get_booking(session, dispute.booking_request_id)
    if booking is None or not domain.user_is_booking_party(user_id, booking):
        raise DisputeNotFoundForParticipant()
    return await _to_public(session, dispute, booking=booking, viewer_user_id=user_id)


async def _bookings_by_id(session: AsyncSession, booking_ids: list[str]) -> dict[str, DisputeBookingRow]:
    """Each of these bookings, keyed by id (missing ones are simply absent)."""
    bookings: dict[str, DisputeBookingRow] = {}
    for booking_id in set(booking_ids):
        booking = await repository.get_booking(session, booking_id)
        if booking is not None:
            bookings[booking_id] = booking
    return bookings


async def _to_public(
    session: AsyncSession, dispute: DisputeRow, *, booking: DisputeBookingRow | None, viewer_user_id: str
) -> DisputePublic:
    """Attach booking context and party labels, and pick the resolution note this viewer should see."""
    viewer_role: Party | None = None
    opened_by_role: Party | None = None
    client_label: str | None = None
    vendor_label: str | None = None
    if booking is not None:
        if booking.client_user_id == viewer_user_id:
            viewer_role = "client"
        elif booking.vendor_user_id == viewer_user_id:
            viewer_role = "vendor"
        if dispute.opened_by_user_id == booking.client_user_id:
            opened_by_role = "client"
        elif dispute.opened_by_user_id == booking.vendor_user_id:
            opened_by_role = "vendor"
        client_labels = await identity.email_labels(session, [booking.client_user_id])
        client_label = client_labels.get(booking.client_user_id, "Client")
        vendor_names = await vendor_listing.display_names(session, [booking.vendor_user_id])
        vendor_label = vendor_names.get(booking.vendor_user_id, "Vendor")
    opened_by_display_name: str | None = None
    if dispute.opened_by_user_id == viewer_user_id:
        opened_by_display_name = "You"
    elif opened_by_role == "client":
        opened_by_display_name = client_label
    elif opened_by_role == "vendor":
        opened_by_display_name = vendor_label
    counterparty_label = None
    if viewer_role == "client":
        counterparty_label = vendor_label
    elif viewer_role == "vendor":
        counterparty_label = client_label
    return DisputePublic(
        id=dispute.id,
        booking_request_id=dispute.booking_request_id,
        opened_by_user_id=dispute.opened_by_user_id,
        status=dispute.status,
        summary=dispute.summary,
        created_at=dispute.created_at,
        updated_at=dispute.updated_at,
        resolved_at=dispute.resolved_at,
        resolution_note=domain.viewer_facing_resolution_note(
            legacy_note=dispute.resolution_note,
            client_note=dispute.client_resolution_note,
            vendor_note=dispute.vendor_resolution_note,
            viewer_role=viewer_role,
        ),
        event_name=booking.event_name if booking else None,
        event_date=booking.event_date if booking else None,
        booking_lifecycle_status=booking.status if booking else None,
        payment_status=booking.payment_status if booking else None,
        conversation_id=dispute.conversation_id or (booking.conversation_id if booking else None),
        opened_by_role=opened_by_role,
        opened_by_you=dispute.opened_by_user_id == viewer_user_id,
        opened_by_display_name=opened_by_display_name,
        client_label=client_label,
        vendor_display_name=vendor_label,
        counterparty_label=counterparty_label,
    )
