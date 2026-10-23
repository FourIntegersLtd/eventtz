"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import type { PaymentReceipt } from "@/lib/receiptsApi";
import { receiptDocumentTitle } from "@/lib/receiptsApi";

type PaymentReceiptViewProps = {
  receipt: PaymentReceipt;
  htmlBlobUrl: string | null;
  htmlLoading?: boolean;
  htmlError?: string | null;
  onRetryPreview?: () => void;
};

/** In-app receipt viewer — previews server-generated HTML (single source of truth). */
export function PaymentReceiptView({
  receipt,
  htmlBlobUrl,
  htmlLoading = false,
  htmlError = null,
  onRetryPreview,
}: PaymentReceiptViewProps) {
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
    setIframeReady(true);
  }, []);

  useEffect(() => {
    setIframeReady(false);
  }, [htmlBlobUrl]);

  useEffect(() => {
    if (!htmlBlobUrl) return;
    const onResize = () => syncIframeHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [htmlBlobUrl, syncIframeHeight]);

  const handleIframeLoad = () => {
    syncIframeHeight();
    requestAnimationFrame(() => {
      syncIframeHeight();
    });
  };

  const handlePrint = () => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow || !iframeReady) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-0.5 text-sm text-ink-3">{receipt.receipt_number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {htmlBlobUrl ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer className="h-4 w-4" aria-hidden />}
              disabled={!iframeReady}
              onClick={handlePrint}
            >
              Print
            </Button>
          ) : null}
          {receipt.stripe_receipt_url ? (
            <a
              href={receipt.stripe_receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className={getButtonClassName({
                variant: "ghost",
                size: "sm",
                className: "inline-flex items-center gap-2",
              })}
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              <span>Card receipt (Stripe)</span>
            </a>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface-3 shadow-sm">
        {htmlLoading ? (
          <div className="flex min-h-[70vh] items-center justify-center text-sm text-ink-3">
            Loading receipt…
          </div>
        ) : htmlError ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-ink-2">
            <p>{htmlError}</p>
            {onRetryPreview ? (
              <Button variant="secondary" size="sm" onClick={onRetryPreview}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : htmlBlobUrl ? (
          <iframe
            ref={iframeRef}
            title={title}
            src={htmlBlobUrl}
            onLoad={handleIframeLoad}
            className="block w-full min-h-[320px] border-0 bg-white"
          />
        ) : null}
      </div>
    </div>
  );
}
