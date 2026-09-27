import type { components } from "@/foundation/platform-client";

type ReceiptDocumentType = components["schemas"]["PaymentReceiptPayload"]["document_type"];

/** Page title for each receipt document type (matches baseline `receiptDocumentTitle`). */
export function receiptDocumentTitle(documentType: ReceiptDocumentType): string {
  if (documentType === "client_payment_receipt") return "Payment receipt";
  if (documentType === "vendor_payment_record") return "Payment record";
  return "Payout statement";
}
