import api from "@/lib/axios";

export type CreateBookingRequestPayload = {
  vendor_user_id: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  /** Venue / event location postcode (optional at request; required before pay). */
  event_postcode?: string | null;
  /** Free-text venue address line(s). */
  event_address?: string | null;
  notes: string | null;
  selected_option_ids: string[];
};

export type BookingRequestCreated = {
  success: boolean;
  id: string;
  status: string;
  created_at: string | null;
};

export async function postBookingRequest(
  payload: CreateBookingRequestPayload,
): Promise<BookingRequestCreated> {
  const { data } = await api.post<BookingRequestCreated>("/api/v1/client/booking-requests", payload);
  return data;
}

function formatAxiosDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) {
      return String((first as { msg: string }).msg);
    }
  }
  return "Request failed. Try again.";
}

export function getBookingRequestErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response?: { data?: { detail?: unknown } } }).response;
    if (r?.data?.detail != null) return formatAxiosDetail(r.data.detail);
  }
  return "Request failed. Try again.";
}
