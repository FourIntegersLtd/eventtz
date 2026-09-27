"use client";

import { useState } from "react";
import { Button } from "@/foundation/ui";
import type { PaymentReceipt } from "@/domains/receipts/api";
import { downloadReceiptHtml } from "@/domains/receipts/receiptDownload";
import { formatReceiptDate, receiptDocumentTitle } from "@/domains/receipts/receiptFormat";

type ReceiptDocumentViewProps = {
  receipt: PaymentReceipt;
};

/** Renders one receipt payload: metadata, line items, totals and document actions. */
export function ReceiptDocumentView({ receipt }: ReceiptDocumentViewProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const title = receiptDocumentTitle(receipt.document_type);
  const counterpartyLabel = receipt.document_type === "client_payment_receipt" ? "Vendor" : "Client";

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReceiptHtml(receipt.document_type, receipt.booking_request_id);
    } catch {
      setDownloadError("Could not download this document. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="receipt-document mt-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">{receipt.receipt_number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" loading={downloading} onClick={() => void handleDownload()}>
            Download
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          {receipt.stripe_receipt_url ? (
            <a
              href={receipt.stripe_receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary-muted"
            >
              Card receipt (Stripe)
            </a>
          ) : null}
        </div>
      </div>

      {downloadError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60 print:hidden">{downloadError}</p>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm shadow-primary/5">
        <div className="border-b border-neutral-100 pb-4">
          <p className="text-lg font-semibold text-neutral-900">{receipt.event_name}</p>
          {receipt.event_date ? (
            <p className="mt-1 text-sm text-neutral-600">Event date: {formatReceiptDate(receipt.event_date)}</p>
          ) : null}
          <p className="mt-1 text-sm text-neutral-600">
            {counterpartyLabel}: {receipt.counterparty_name}
          </p>
          {receipt.paid_at ? (
            <p className="mt-1 text-sm text-neutral-500">Paid: {formatReceiptDate(receipt.paid_at)}</p>
          ) : null}
          {receipt.payout_released_at && receipt.document_type !== "client_payment_receipt" ? (
            <p className="mt-1 text-sm text-neutral-500">Payout: {formatReceiptDate(receipt.payout_released_at)}</p>
          ) : null}
          {receipt.payment_reference ? (
            <p className="mt-1 text-sm text-neutral-500">Payment ref: {receipt.payment_reference}</p>
          ) : null}
          {receipt.transfer_reference ? (
            <p className="mt-1 text-sm text-neutral-500">Transfer ref: {receipt.transfer_reference}</p>
          ) : null}
        </div>

        {receipt.line_items && receipt.line_items.length > 0 ? (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipt.line_items.map((line) => (
                <tr key={`${line.label}-${line.amount_label}`} className="border-b border-neutral-50">
                  <td className="py-2 pr-4 text-neutral-800">{line.label}</td>
                  <td className="py-2 text-right tabular-nums text-neutral-900">{line.amount_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="mt-4 space-y-1 border-t border-neutral-100 pt-4 text-sm">
          {receipt.subtotal_label ? (
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span className="tabular-nums text-neutral-900">{receipt.subtotal_label}</span>
            </div>
          ) : null}
          {receipt.service_fee_label ? (
            <div className="flex justify-between text-neutral-600">
              <span>
                Service fee
                {receipt.service_fee_percent != null ? ` (${receipt.service_fee_percent}%)` : ""}
              </span>
              <span className="tabular-nums text-neutral-900">{receipt.service_fee_label}</span>
            </div>
          ) : null}
          {receipt.vendor_share_label ? (
            <div className="flex justify-between text-neutral-600">
              <span>Vendor share</span>
              <span className="tabular-nums text-neutral-900">{receipt.vendor_share_label}</span>
            </div>
          ) : null}
          {receipt.platform_fee_label ? (
            <div className="flex justify-between text-neutral-600">
              <span>Platform fee</span>
              <span className="tabular-nums text-neutral-900">{receipt.platform_fee_label}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold text-neutral-900">
            <span>Total</span>
            <span className="tabular-nums">{receipt.total_label}</span>
          </div>
        </div>

        {receipt.status_note ? (
          <p className="mt-4 text-sm text-neutral-600">{receipt.status_note}</p>
        ) : null}
      </div>
    </div>
  );
}
