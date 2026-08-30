"use client";

import Link from "next/link";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import type { PaymentReceipt } from "@/lib/receiptsApi";
import { receiptViewHref } from "@/lib/receiptsApi";

type ReceiptActionsProps = {
  bookingId: string;
  documentType: PaymentReceipt["document_type"];
  compact?: boolean;
};

export function ReceiptActions({ bookingId, documentType, compact = false }: ReceiptActionsProps) {
  const href = receiptViewHref(documentType, bookingId);

  const label =
    documentType === "client_payment_receipt"
      ? "View receipt"
      : documentType === "vendor_payment_record"
        ? "Payment record"
        : "Payout statement";

  if (compact) {
    return (
      <Link
        href={href}
        className="text-sm font-medium text-[#3e1964] hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link href={href} className={getButtonClassName({ variant: "secondary", size: "sm" })}>
      {label}
    </Link>
  );
}
