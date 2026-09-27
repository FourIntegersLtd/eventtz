import type { components } from "@/foundation/platform-client";

export type ReceiptDocumentType = components["schemas"]["PaymentReceiptPayload"]["document_type"];

const RECEIPT_ELIGIBLE = new Set(["paid", "payout_released", "refunded", "partially_refunded"]);

/** True when the baseline shows receipt / payment-record links for this `payment_status`. */
export function hasPaymentReceipt(paymentStatus: string | undefined | null): boolean {
  return RECEIPT_ELIGIBLE.has(String(paymentStatus || "unpaid"));
}

/** In-app path for viewing a receipt document (matches baseline `receiptViewHref`). */
export function receiptViewHref(documentType: ReceiptDocumentType, bookingId: string): string {
  if (documentType === "client_payment_receipt") {
    return `/client/bookings/${bookingId}/receipt`;
  }
  if (documentType === "vendor_payment_record") {
    return `/vendor/bookings/${bookingId}/payment-record`;
  }
  return `/vendor/bookings/${bookingId}/payout-statement`;
}
