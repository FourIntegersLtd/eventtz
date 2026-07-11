import api from "@/lib/axios";

export type ParticipantRole = "client" | "vendor";

export type ParticipantDispute = {
  id: string;
  booking_request_id: string;
  opened_by_user_id: string;
  status: "open" | "under_review" | "resolved" | "closed";
  summary: string;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  /** True if an in-app Messages thread was linked for staff review when the case was opened. */
  chat_included_for_review?: boolean;
  event_name?: string | null;
  event_date?: string | null;
  booking_status?: string | null;
  conversation_id?: string | null;
  opened_by_role?: "client" | "vendor" | null;
  opened_by_you?: boolean;
  opened_by_display_name?: string | null;
  client_label?: string | null;
  vendor_display_name?: string | null;
  counterparty_label?: string | null;
  payment_status?: string | null;
};

function participantDisputesPath(role: ParticipantRole, suffix: string): string {
  return `/api/v1/${role}/${suffix}`;
}

export async function fetchParticipantBookingDisputes(
  role: ParticipantRole,
  bookingId: string,
): Promise<ParticipantDispute[]> {
  const { data } = await api.get<{ success: boolean; disputes: ParticipantDispute[] }>(
    participantDisputesPath(role, `booking-requests/${bookingId}/disputes`),
  );
  return data.disputes ?? [];
}

export async function postParticipantBookingDispute(
  role: ParticipantRole,
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  const { data } = await api.post<{ success: boolean; dispute: ParticipantDispute }>(
    participantDisputesPath(role, `booking-requests/${bookingId}/disputes`),
    { summary },
  );
  return data.dispute;
}

export async function fetchParticipantDisputes(role: ParticipantRole): Promise<ParticipantDispute[]> {
  const { data } = await api.get<{ success: boolean; disputes: ParticipantDispute[] }>(
    participantDisputesPath(role, "disputes"),
  );
  return data.disputes ?? [];
}

export async function fetchParticipantDispute(
  role: ParticipantRole,
  disputeId: string,
): Promise<ParticipantDispute> {
  const { data } = await api.get<{ success: boolean; dispute: ParticipantDispute }>(
    participantDisputesPath(role, `disputes/${encodeURIComponent(disputeId)}`),
  );
  return data.dispute;
}

export async function fetchClientBookingDisputes(bookingId: string): Promise<ParticipantDispute[]> {
  return fetchParticipantBookingDisputes("client", bookingId);
}

export async function postClientBookingDispute(
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  return postParticipantBookingDispute("client", bookingId, summary);
}

export async function fetchVendorBookingDisputes(bookingId: string): Promise<ParticipantDispute[]> {
  return fetchParticipantBookingDisputes("vendor", bookingId);
}

export async function postVendorBookingDispute(
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  return postParticipantBookingDispute("vendor", bookingId, summary);
}

export async function fetchClientDisputes(): Promise<ParticipantDispute[]> {
  return fetchParticipantDisputes("client");
}

export async function fetchVendorDisputes(): Promise<ParticipantDispute[]> {
  return fetchParticipantDisputes("vendor");
}

export async function fetchClientDispute(disputeId: string): Promise<ParticipantDispute> {
  return fetchParticipantDispute("client", disputeId);
}

export async function fetchVendorDispute(disputeId: string): Promise<ParticipantDispute> {
  return fetchParticipantDispute("vendor", disputeId);
}
