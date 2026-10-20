import type { PortalRole } from "@/components/portal-shell/portalNav";
import type { ParticipantDispute } from "@/lib/bookingDisputesApi";

type BookingPartySnapshot = {
  booking_request_id: string;
  booking_status: string;
  event_name: string;
  event_date: string;
  payment_status?: string;
  conversation_id?: string | null;
  vendor_user_id?: string;
  vendor_display_name?: string;
  client_user_id?: string | null;
  client_email?: string | null;
};

export type ParticipantDisputeViewer = {
  role: PortalRole;
  userId: string;
  email?: string | null;
};

function normId(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function participantDisputeNeedsHydration(dispute: ParticipantDispute): boolean {
  return (
    !dispute.event_name &&
    !dispute.booking_lifecycle_status &&
    !dispute.client_label &&
    !dispute.vendor_display_name &&
    !dispute.opened_by_role
  );
}

export function enrichParticipantDispute(
  dispute: ParticipantDispute,
  booking: BookingPartySnapshot,
  viewer: ParticipantDisputeViewer,
): ParticipantDispute {
  const oid = normId(dispute.opened_by_user_id);
  const cid = normId(booking.client_user_id ?? (viewer.role === "client" ? viewer.userId : ""));
  const vid = normId(booking.vendor_user_id ?? (viewer.role === "vendor" ? viewer.userId : ""));
  const viewerId = normId(viewer.userId);

  let openedByRole = dispute.opened_by_role ?? null;
  if (!openedByRole && oid) {
    if (oid === cid) openedByRole = "client";
    else if (oid === vid) openedByRole = "vendor";
  }

  const clientLabel =
    dispute.client_label ??
    (viewer.role === "client"
      ? (viewer.email?.trim() || booking.client_email?.trim() || "Client")
      : (booking.client_email?.trim() || "Client"));

  const vendorLabel =
    dispute.vendor_display_name ??
    booking.vendor_display_name?.trim() ??
    (viewer.role === "vendor" ? "Your business" : "Vendor");

  const openedByYou = dispute.opened_by_you ?? Boolean(oid && oid === viewerId);
  let openedByDisplay = dispute.opened_by_display_name ?? null;
  if (!openedByDisplay) {
    if (openedByYou) openedByDisplay = "You";
    else if (openedByRole === "client") openedByDisplay = clientLabel;
    else if (openedByRole === "vendor") openedByDisplay = vendorLabel;
    else if (oid) openedByDisplay = "A party on this booking";
  }

  const counterpartyLabel =
    dispute.counterparty_label ??
    (viewerId === cid ? vendorLabel : clientLabel);

  return {
    ...dispute,
    event_name: dispute.event_name ?? booking.event_name ?? null,
    event_date: dispute.event_date ?? booking.event_date ?? null,
    booking_lifecycle_status:
      dispute.booking_lifecycle_status ?? booking.booking_status ?? null,
    payment_status: dispute.payment_status ?? booking.payment_status ?? null,
    conversation_id: dispute.conversation_id ?? booking.conversation_id ?? null,
    opened_by_role: openedByRole,
    opened_by_you: openedByYou,
    opened_by_display_name: openedByDisplay,
    client_label: clientLabel,
    vendor_display_name: vendorLabel,
    counterparty_label: counterpartyLabel,
  };
}

export function enrichParticipantDisputes(
  disputes: ParticipantDispute[],
  bookingsById: Map<string, BookingPartySnapshot>,
  viewer: ParticipantDisputeViewer,
): ParticipantDispute[] {
  return disputes.map((dispute) => {
    if (!participantDisputeNeedsHydration(dispute)) return dispute;
    const booking = bookingsById.get(dispute.booking_request_id);
    if (!booking) return dispute;
    return enrichParticipantDispute(dispute, booking, viewer);
  });
}

/** Dispute list payloads from the API already include booking context; no bulk booking fetch. */
export async function loadParticipantBookingLookup(
  _role: PortalRole,
): Promise<Map<string, BookingPartySnapshot>> {
  return new Map();
}
