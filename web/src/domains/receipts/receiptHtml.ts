import { platformRequestText } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client";

export type ReceiptDocumentKind = components["schemas"]["PaymentReceiptPayload"]["document_type"];

/** Same-origin path for the server-rendered HTML receipt document. */
export function receiptHtmlPath(kind: ReceiptDocumentKind, bookingId: string): string {
  const encoded = encodeURIComponent(bookingId);
  if (kind === "client_payment_receipt") {
    return `/api/v1/client/booking-requests/${encoded}/receipt.html`;
  }
  if (kind === "vendor_payment_record") {
    return `/api/v1/vendor/booking-requests/${encoded}/payment-record.html`;
  }
  return `/api/v1/vendor/booking-requests/${encoded}/payout-statement.html`;
}

/** Fetch the frozen receipt HTML with auth (single source of truth for preview and print). */
export async function fetchReceiptHtmlBlob(bookingId: string, kind: ReceiptDocumentKind): Promise<Blob> {
  const { text } = await platformRequestText(receiptHtmlPath(kind, bookingId), {
    headers: { Accept: "text/html" },
  });
  return new Blob([text], { type: "text/html;charset=utf-8" });
}
