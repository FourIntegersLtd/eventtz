"use client";

import Link from "next/link";
import { hasPaymentReceipt, receiptViewHref, type ReceiptDocumentType } from "@/capabilities/receipt-links/receiptLinks";

type ReceiptLinkProps = {
  bookingId: string;
  documentType: ReceiptDocumentType;
  compact?: boolean;
  paymentStatus?: string | null;
};

function receiptLinkLabel(documentType: ReceiptDocumentType): string {
  if (documentType === "client_payment_receipt") return "View receipt";
  if (documentType === "vendor_payment_record") return "Payment record";
  return "Payout statement";
}

/** Link to a receipt page; optional `paymentStatus` hides the link when not eligible. */
export function ReceiptLink({ bookingId, documentType, compact = false, paymentStatus }: ReceiptLinkProps) {
  if (paymentStatus !== undefined && !hasPaymentReceipt(paymentStatus)) {
    return null;
  }

  const href = receiptViewHref(documentType, bookingId);
  const label = receiptLinkLabel(documentType);

  if (compact) {
    return (
      <Link
        href={href}
        className="text-sm font-medium text-primary hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary-muted"
    >
      {label}
    </Link>
  );
}
