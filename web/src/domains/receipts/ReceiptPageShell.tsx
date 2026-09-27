"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoadingState } from "@/foundation/ui";
import { platformErrorDetail } from "@/foundation/platform-client";
import type { PaymentReceipt } from "@/domains/receipts/api";
import { fetchReceiptHtmlBlob } from "@/domains/receipts/receiptHtml";
import { PaymentReceiptPreview } from "@/domains/receipts/PaymentReceiptPreview";

type ReceiptPageShellProps = {
  bookingId: string;
  backHref: string;
  backLabel: string;
  load: (bookingId: string) => Promise<PaymentReceipt>;
};

const LOAD_ERROR_FALLBACK = "Could not load this document. It may not be available yet.";
const HTML_PREVIEW_FALLBACK = "Could not load the receipt preview.";

interface ReceiptLoadState {
  bookingId: string;
  receipt: PaymentReceipt | null;
  error: string | null;
  htmlBlobUrl: string | null;
  htmlLoading: boolean;
  htmlError: string | null;
}

/** Shared receipt route chrome: back link, JSON load, then HTML preview in an iframe. */
export function ReceiptPageShell({ bookingId, backHref, backLabel, load }: ReceiptPageShellProps) {
  const [state, setState] = useState<ReceiptLoadState | null>(null);
  const fetchIdRef = useRef(0);
  const htmlBlobUrlRef = useRef<string | null>(null);

  const revokeBlobUrl = useCallback((url: string | null) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }, []);

  const runLoad = useCallback(() => {
    const requestId = ++fetchIdRef.current;

    if (!bookingId) {
      setState({
        bookingId,
        receipt: null,
        error: "Invalid booking.",
        htmlBlobUrl: null,
        htmlLoading: false,
        htmlError: null,
      });
      return;
    }

    load(bookingId)
      .then(async (data) => {
        if (requestId !== fetchIdRef.current) return;

        revokeBlobUrl(htmlBlobUrlRef.current);
        htmlBlobUrlRef.current = null;
        setState({
          bookingId,
          receipt: data,
          error: null,
          htmlBlobUrl: null,
          htmlLoading: true,
          htmlError: null,
        });

        try {
          const blob = await fetchReceiptHtmlBlob(bookingId, data.document_type);
          if (requestId !== fetchIdRef.current) return;
          const blobUrl = URL.createObjectURL(blob);
          htmlBlobUrlRef.current = blobUrl;
          setState((previous) =>
            previous && previous.bookingId === bookingId
              ? { ...previous, htmlBlobUrl: blobUrl, htmlLoading: false, htmlError: null }
              : previous,
          );
        } catch (htmlErr) {
          if (requestId !== fetchIdRef.current) return;
          setState((previous) =>
            previous && previous.bookingId === bookingId
              ? {
                  ...previous,
                  htmlLoading: false,
                  htmlError: platformErrorDetail(htmlErr) ?? HTML_PREVIEW_FALLBACK,
                }
              : previous,
          );
        }
      })
      .catch((loadErr) => {
        if (requestId !== fetchIdRef.current) return;
        revokeBlobUrl(htmlBlobUrlRef.current);
        htmlBlobUrlRef.current = null;
        setState({
          bookingId,
          receipt: null,
          error: platformErrorDetail(loadErr) ?? LOAD_ERROR_FALLBACK,
          htmlBlobUrl: null,
          htmlLoading: false,
          htmlError: null,
        });
      });
  }, [bookingId, load, revokeBlobUrl]);

  useEffect(() => {
    runLoad();
  }, [runLoad]);

  useEffect(() => {
    return () => {
      revokeBlobUrl(htmlBlobUrlRef.current);
      htmlBlobUrlRef.current = null;
    };
  }, [revokeBlobUrl]);

  const loading = state?.bookingId !== bookingId;
  const receipt = !loading && state?.receipt ? state.receipt : null;
  const error = !loading ? state?.error ?? null : null;
  const htmlBlobUrl = state?.htmlBlobUrl ?? null;
  const htmlLoading = state?.htmlLoading ?? false;
  const htmlError = state?.htmlError ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-8 sm:px-6">
      <Link href={backHref} className="inline-block text-sm font-medium text-neutral-500 hover:text-primary">
        ← {backLabel}
      </Link>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingState variant="inline" label="Loading…" />
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
        <div className="mt-6 min-w-0">
          <PaymentReceiptPreview
            key={htmlBlobUrl ?? "pending-html"}
            receipt={receipt}
            htmlBlobUrl={htmlBlobUrl}
            htmlLoading={htmlLoading}
            htmlError={htmlError}
            onRetryPreview={runLoad}
          />
        </div>
      ) : null}
    </div>
  );
}
