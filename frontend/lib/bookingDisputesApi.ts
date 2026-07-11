import api from "@/lib/axios";

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
};

export async function fetchClientBookingDisputes(bookingId: string): Promise<ParticipantDispute[]> {
  const { data } = await api.get<{ success: boolean; disputes: ParticipantDispute[] }>(
    `/api/v1/client/booking-requests/${bookingId}/disputes`,
  );
  return data.disputes ?? [];
}

export async function postClientBookingDispute(
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  const { data } = await api.post<{ success: boolean; dispute: ParticipantDispute }>(
    `/api/v1/client/booking-requests/${bookingId}/disputes`,
    { summary },
  );
  return data.dispute;
}

export async function fetchVendorBookingDisputes(bookingId: string): Promise<ParticipantDispute[]> {
  const { data } = await api.get<{ success: boolean; disputes: ParticipantDispute[] }>(
    `/api/v1/vendor/booking-requests/${bookingId}/disputes`,
  );
  return data.disputes ?? [];
}

export async function postVendorBookingDispute(
  bookingId: string,
  summary: string,
): Promise<ParticipantDispute> {
  const { data } = await api.post<{ success: boolean; dispute: ParticipantDispute }>(
    `/api/v1/vendor/booking-requests/${bookingId}/disputes`,
    { summary },
  );
  return data.dispute;
}

export async function fetchClientDisputes(): Promise<ParticipantDispute[]> {
  const { data } = await api.get<{ success: boolean; disputes: ParticipantDispute[] }>(
    "/api/v1/client/disputes",
  );
  return data.disputes ?? [];
}

export async function fetchVendorDisputes(): Promise<ParticipantDispute[]> {
  const { data } = await api.get<{ success: boolean; disputes: ParticipantDispute[] }>(
    "/api/v1/vendor/disputes",
  );
  return data.disputes ?? [];
}
