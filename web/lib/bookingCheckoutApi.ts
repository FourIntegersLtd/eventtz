import api from "@/lib/axios";
export { getApiErrorDetail } from "@/lib/api-errors";

export type BookingCheckoutResponse = {
  success: boolean;
  checkout_url: string;
};

export type BookingCheckoutSyncResponse = {
  success: boolean;
  payment_status: string;
};

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
  const { data } = await api.post<BookingCheckoutSyncResponse>(
    `/api/v1/client/booking-requests/${bookingId}/checkout/sync`,
    sessionId ? { session_id: sessionId } : {},
  );
  return data;
}
