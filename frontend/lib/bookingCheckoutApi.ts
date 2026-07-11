import api from "@/lib/axios";
export { getApiErrorDetail } from "@/lib/api-errors";

export type BookingCheckoutResponse = {
  success: boolean;
  checkout_url: string;
};

/** Starts a Stripe Checkout session for an accepted, unpaid client booking. */
export async function postBookingCheckout(bookingId: string): Promise<string> {
  const { data } = await api.post<BookingCheckoutResponse>(
    `/api/v1/client/booking-requests/${bookingId}/checkout`,
  );
  return data.checkout_url;
}
