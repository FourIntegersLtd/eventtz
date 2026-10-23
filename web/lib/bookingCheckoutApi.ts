import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";
export { getApiErrorDetail } from "@/lib/api-errors";

export type BookingCheckoutResponse = components["schemas"]["BookingCheckoutResponse"];

export type BookingCheckoutSyncResponse = components["schemas"]["BookingCheckoutSyncResponse"];

/** Starts a Stripe Checkout session for an accepted, unpaid client booking. */
export async function postBookingCheckout(bookingId: string): Promise<string> {
  const { data } = await api.post<BookingCheckoutResponse>(
    `/api/v1/client/booking-requests/${bookingId}/checkout`,
  );
  return data.checkout_url;
}

/** Confirms payment after Stripe redirect (fallback when webhooks are not configured). */
export async function postBookingCheckoutSync(
  bookingId: string,
  sessionId?: string | null,
): Promise<BookingCheckoutSyncResponse> {
  const body: components["schemas"]["BookingCheckoutSyncBody"] = sessionId
    ? { session_id: sessionId }
    : {};
  const { data } = await api.post<BookingCheckoutSyncResponse>(
    `/api/v1/client/booking-requests/${bookingId}/checkout/sync`,
    body,
  );
  return data;
}
