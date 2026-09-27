/**
 * Which portal a shared disputes screen is speaking for.
 *
 * Client and vendor disputes are the same screens with different URLs. This
 * module is the only place that chooses an endpoint, a link, or a label from
 * the role, so both portals stay in lockstep and the choice can be tested
 * without rendering.
 */

/** The two portals that list and view disputes. Neither page moves money. */
export type DisputePortalRole = "client" | "vendor";

/** `GET /api/v1/{role}/disputes` — the caller's disputes, most recently opened first. */
export function disputesCollectionPath(role: DisputePortalRole): string {
  return role === "client" ? "/api/v1/client/disputes" : "/api/v1/vendor/disputes";
}

/** `GET /api/v1/{role}/disputes/{disputeId}` for one dispute the caller is party to. */
export function disputeResourcePath(role: DisputePortalRole, disputeId: string): string {
  const encodedId = encodeURIComponent(disputeId);
  return role === "client"
    ? `/api/v1/client/disputes/${encodedId}`
    : `/api/v1/vendor/disputes/${encodedId}`;
}

/** The list page for this portal. */
export function disputesListHref(role: DisputePortalRole): string {
  return role === "client" ? "/client/disputes" : "/vendor/disputes";
}

/** One dispute's detail page for this portal. */
export function disputeDetailHref(role: DisputePortalRole, disputeId: string): string {
  const encodedId = encodeURIComponent(disputeId);
  return role === "client" ? `/client/disputes/${encodedId}` : `/vendor/disputes/${encodedId}`;
}

/** The booking that the dispute is about, on this portal. */
export function bookingHref(role: DisputePortalRole, bookingId: string): string {
  const encodedId = encodeURIComponent(bookingId);
  return role === "client" ? `/client/bookings/${encodedId}` : `/vendor/bookings/${encodedId}`;
}

/**
 * The support thread staff opened for this dispute, on this portal's help
 * hub, or null when there is none yet. Matches the baseline's "Open messages"
 * button, which is hidden without a `conversation_id`.
 */
export function disputeMessagesHref(role: DisputePortalRole, conversationId: string | null | undefined): string | null {
  if (!conversationId) return null;
  const encodedId = encodeURIComponent(conversationId);
  return role === "client" ? `/client/help/messages/${encodedId}` : `/vendor/help/messages/${encodedId}`;
}

/**
 * The other party on a dispute: a client is looking at the vendor, a vendor
 * at the client. Matches `ParticipantDisputeDetailPanel`.
 */
export function counterpartyFieldLabel(role: DisputePortalRole): "Vendor" | "Client" {
  return role === "client" ? "Vendor" : "Client";
}

/** The other party's display name, or "-" when the API didn't send one. */
export function counterpartyName(
  role: DisputePortalRole,
  dispute: { vendor_display_name?: string | null; client_label?: string | null },
): string {
  const name = role === "client" ? dispute.vendor_display_name : dispute.client_label;
  const trimmed = name?.trim();
  return trimmed ? trimmed : "-";
}
