import type { components } from "@/foundation/platform-client";

type ReceiptDocumentType = components["schemas"]["PaymentReceiptPayload"]["document_type"];

/** Payment states where the baseline shows a client payment receipt link. */
const RECEIPT_ELIGIBLE_STATUSES = new Set(["paid", "payout_released", "refunded", "partially_refunded"]);

/** True when the booking's `payment_status` allows opening a receipt page. */
export function bookingHasPaymentReceipt(paymentStatus: string): boolean {
  return RECEIPT_ELIGIBLE_STATUSES.has(paymentStatus);
}

/** Formats integer pence as a UK currency string, e.g. `£1,234.50`. */
export function formatReceiptMoneyFromPence(pence: number): string {
  return formatReceiptMoneyFromGbp(pence / 100);
}

/** Formats a GBP float as a UK currency string, e.g. `£1,234.50`. */
export function formatReceiptMoneyFromGbp(amountGbp: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amountGbp);
}

/** Formats an ISO date (or datetime) for receipt headers, e.g. `Sun, 12 Jul 2026`. */
export function formatReceiptDate(isoDate: string | null | undefined): string {
  if (!isoDate || isoDate.length < 10) return isoDate ?? "";
  const parsed = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Page title for each receipt document type (matches baseline `receiptDocumentTitle`). */
export function receiptDocumentTitle(documentType: ReceiptDocumentType): string {
  if (documentType === "client_payment_receipt") return "Payment receipt";
  if (documentType === "vendor_payment_record") return "Payment record";
  return "Payout statement";
}

/**
 * The note shown under the total for refund states (mirrors `api` `domain_receipts._status_note`).
 * The live payload usually includes `status_note` already; this helper is for tests and fallbacks.
 */
export function receiptStatusNote(paymentStatus: string): string | null {
  if (paymentStatus === "refunded") return "This payment was refunded in full.";
  if (paymentStatus === "partially_refunded") return "This payment was partially refunded.";
  return null;
}
