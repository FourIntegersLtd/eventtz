import { platformRequestText } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client";

export type ReceiptDocumentKind = components["schemas"]["PaymentReceiptPayload"]["document_type"];

/** Same-origin path for the downloadable HTML variant of a receipt document. */
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

/**
 * Parses `filename="..."` from a `Content-Disposition` header (RFC 5987 not needed
 * for our receipt filenames).
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const quoted = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  if (!quoted?.[1]) return null;
  try {
    return decodeURIComponent(quoted[1].replace(/"/g, "").trim());
  } catch {
    return quoted[1].replace(/"/g, "").trim();
  }
}

/** Fetches receipt HTML with auth and triggers a browser download of the `.html` file. */
export async function downloadReceiptHtml(kind: ReceiptDocumentKind, bookingId: string): Promise<void> {
  const path = receiptHtmlPath(kind, bookingId);
  const { text, headers } = await platformRequestText(path, {
    headers: { Accept: "text/html" },
  });
  const fallback =
    kind === "client_payment_receipt"
      ? `receipt-${bookingId}.html`
      : kind === "vendor_payment_record"
        ? `payment-record-${bookingId}.html`
        : `payout-statement-${bookingId}.html`;
  const filename = filenameFromContentDisposition(headers.get("Content-Disposition")) ?? fallback;
  const blob = new Blob([text], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
