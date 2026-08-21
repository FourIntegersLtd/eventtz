import api from "@/lib/axios";

export type ReceiptLineItem = {
  label: string;
  amount_label: string;
};

export type ReceiptDocumentType =
  | "client_payment_receipt"
  | "vendor_payment_record"
  | "vendor_payout_statement";

export type PaymentReceipt = {
  document_type: ReceiptDocumentType;
  receipt_number: string;
  booking_request_id: string;
  event_name: string;
  event_date: string;
  payment_status: string;
  paid_at: string | null;
  payout_released_at: string | null;
  counterparty_name: string;
  line_items: ReceiptLineItem[];
  subtotal_label: string | null;
  service_fee_label: string | null;
  service_fee_percent: number | null;
  total_label: string;
  vendor_share_label: string | null;
  platform_fee_label: string | null;
  payment_reference: string | null;
  transfer_reference: string | null;
  stripe_receipt_url: string | null;
  status_note: string | null;
};

type PaymentReceiptResponse = {
  success: boolean;
  receipt: PaymentReceipt;
};

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
