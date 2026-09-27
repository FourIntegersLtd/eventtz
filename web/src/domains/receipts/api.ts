import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client";

export type PaymentReceipt = components["schemas"]["PaymentReceiptPayload"];

type PaymentReceiptResponse = components["schemas"]["PaymentReceiptResponse"];

/** Loads the client's payment receipt JSON for a booking. */
export async function fetchClientReceipt(bookingId: string): Promise<PaymentReceipt> {
  const response = await platformRequest<PaymentReceiptResponse>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/receipt`,
  );
  return response.receipt;
}

/** Loads the vendor's payment record JSON for a booking. */
export async function fetchVendorPaymentRecord(bookingId: string): Promise<PaymentReceipt> {
  const response = await platformRequest<PaymentReceiptResponse>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}/payment-record`,
  );
  return response.receipt;
}

/** Loads the vendor's payout statement JSON for a booking. */
export async function fetchVendorPayoutStatement(bookingId: string): Promise<PaymentReceipt> {
  const response = await platformRequest<PaymentReceiptResponse>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}/payout-statement`,
  );
  return response.receipt;
}
