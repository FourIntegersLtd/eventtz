import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type ReceiptLineItem = components["schemas"]["ReceiptLineItem"];

export type PaymentReceipt = components["schemas"]["PaymentReceiptPayload"];

export type ReceiptDocumentType = PaymentReceipt["document_type"];

type PaymentReceiptResponse = components["schemas"]["PaymentReceiptResponse"];

const RECEIPT_ELIGIBLE = new Set(["paid", "payout_released", "refunded", "partially_refunded"]);

export function hasPaymentReceipt(paymentStatus: string | undefined | null): boolean {
  return RECEIPT_ELIGIBLE.has(String(paymentStatus || "unpaid"));
}

export function receiptDocumentTitle(documentType: ReceiptDocumentType): string {
  if (documentType === "client_payment_receipt") return "Payment receipt";
  if (documentType === "vendor_payment_record") return "Payment record";
  return "Payout statement";
}

export function receiptViewHref(documentType: ReceiptDocumentType, bookingId: string): string {
  if (documentType === "client_payment_receipt") {
    return `/client/bookings/${bookingId}/receipt`;
  }
  if (documentType === "vendor_payment_record") {
    return `/vendor/bookings/${bookingId}/payment-record`;
  }
  return `/vendor/bookings/${bookingId}/payout-statement`;
}

export async function fetchClientPaymentReceipt(bookingId: string): Promise<PaymentReceipt> {
  const { data } = await api.get<PaymentReceiptResponse>(
    `/api/v1/client/booking-requests/${bookingId}/receipt`,
  );
  return data.receipt;
}

export async function fetchVendorPaymentRecord(bookingId: string): Promise<PaymentReceipt> {
  const { data } = await api.get<PaymentReceiptResponse>(
    `/api/v1/vendor/booking-requests/${bookingId}/payment-record`,
  );
  return data.receipt;
}

export async function fetchVendorPayoutStatement(bookingId: string): Promise<PaymentReceipt> {
  const { data } = await api.get<PaymentReceiptResponse>(
    `/api/v1/vendor/booking-requests/${bookingId}/payout-statement`,
  );
  return data.receipt;
}

function receiptHtmlPath(bookingId: string, documentType: ReceiptDocumentType): string {
  if (documentType === "client_payment_receipt") {
    return `/api/v1/client/booking-requests/${bookingId}/receipt.html`;
  }
  if (documentType === "vendor_payment_record") {
    return `/api/v1/vendor/booking-requests/${bookingId}/payment-record.html`;
  }
  return `/api/v1/vendor/booking-requests/${bookingId}/payout-statement.html`;
}

/** Fetch the server-generated HTML receipt (from frozen snapshot). */
export async function fetchReceiptHtmlBlob(
  bookingId: string,
  documentType: ReceiptDocumentType,
): Promise<Blob> {
  const { data } = await api.get<Blob>(receiptHtmlPath(bookingId, documentType), {
    responseType: "blob",
  });
  return data;
}
