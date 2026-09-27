"use client";

import Link from "next/link";
import { Spinner } from "@/foundation/ui";
import type { PaymentReceipt } from "@/domains/receipts/api";
import { useReceipt } from "@/domains/receipts/useReceipt";
import { ReceiptDocumentView } from "@/domains/receipts/ReceiptDocumentView";

type ReceiptPageShellProps = {
  bookingId: string;
  backHref: string;
  backLabel: string;
  load: (bookingId: string) => Promise<PaymentReceipt>;
};

/** Shared receipt route chrome: back link, loading and error states, then the document. */
export function ReceiptPageShell({ bookingId, backHref, backLabel, load }: ReceiptPageShellProps) {
  const { receipt, loading, error } = useReceipt(bookingId, load);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href={backHref} className="print:hidden inline-block text-sm font-medium text-neutral-500 hover:text-primary">
        ← {backLabel}
      </Link>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading…" />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Document unavailable</h1>
          <p className="mt-2 text-sm text-neutral-600">{error}</p>
          <Link href={backHref} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Back to booking
          </Link>
        </div>
      ) : receipt ? (
        <ReceiptDocumentView receipt={receipt} />
      ) : null}
    </div>
  );
}
