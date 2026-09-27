"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/foundation/ui";
import type { PaymentReceipt } from "@/domains/receipts/api";
import { receiptDocumentTitle } from "@/domains/receipts/receiptFormat";

type PaymentReceiptPreviewProps = {
  receipt: PaymentReceipt;
  htmlBlobUrl: string | null;
  htmlLoading?: boolean;
  htmlError?: string | null;
  onRetryPreview?: () => void;
};

/** In-app receipt viewer — previews server-generated HTML (single source of truth). */
export function PaymentReceiptPreview({
  receipt,
  htmlBlobUrl,
  htmlLoading = false,
  htmlError = null,
  onRetryPreview,
}: PaymentReceiptPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const title = receiptDocumentTitle(receipt.document_type);

  const syncIframeHeight = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    const doc = frame.contentDocument ?? frame.contentWindow?.document;
    if (!doc?.body) return;
    const height = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight,
      doc.body.offsetHeight,
    );
    frame.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    if (!htmlBlobUrl) return;
    const frame = iframeRef.current;
    if (!frame) return;

    const onLoad = () => {
      syncIframeHeight();
      requestAnimationFrame(() => syncIframeHeight());
      setIframeReady(true);
    };

    frame.addEventListener("load", onLoad);
    if (frame.contentDocument?.readyState === "complete") onLoad();
    return () => frame.removeEventListener("load", onLoad);
  }, [htmlBlobUrl, syncIframeHeight]);

  useEffect(() => {
    if (!htmlBlobUrl) return;
    const onResize = () => syncIframeHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [htmlBlobUrl, syncIframeHeight]);

  const handlePrint = () => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow || !iframeReady) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">{receipt.receipt_number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {htmlBlobUrl ? (
            <Button type="button" variant="secondary" disabled={!iframeReady} onClick={handlePrint}>
              Print
            </Button>
          ) : null}
          {receipt.stripe_receipt_url ? (
            <a
              href={receipt.stripe_receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              <span aria-hidden>↗</span>
              <span>Card receipt (Stripe)</span>
            </a>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm">
        {htmlLoading ? (
          <div className="flex min-h-[70vh] items-center justify-center text-sm text-neutral-500">Loading receipt…</div>
        ) : htmlError ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-neutral-600">
            <p>{htmlError}</p>
            {onRetryPreview ? (
              <Button type="button" variant="secondary" onClick={onRetryPreview}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : htmlBlobUrl ? (
          <iframe
            key={htmlBlobUrl}
            ref={iframeRef}
            title={title}
            src={htmlBlobUrl}
            className="block w-full min-h-[320px] max-w-full border-0 bg-white"
          />
        ) : null}
      </div>
    </div>
  );
}
