"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { PaymentReceiptView } from "@/features/receipts/PaymentReceiptView";
import { getApiErrorDetail } from "@/lib/api-errors";
import type { PaymentReceipt } from "@/lib/receiptsApi";
import { fetchReceiptHtmlBlob } from "@/lib/receiptsApi";

type ReceiptPageShellProps = {
  bookingId: string;
  backHref: string;
  backLabel: string;
  load: (bookingId: string) => Promise<PaymentReceipt>;
};

export function ReceiptPageShell({
  bookingId,
  backHref,
  backLabel,
  load,
}: ReceiptPageShellProps) {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [htmlBlobUrl, setHtmlBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const fetchReceipt = useCallback(async () => {
    const requestId = ++fetchIdRef.current;

    if (!bookingId) {
      setReceipt(null);
      setLoading(false);
      setHtmlLoading(false);
      setError("Invalid booking.");
      return;
    }

    setLoading(true);
    setHtmlLoading(true);
    setError(null);
    setHtmlError(null);
    setReceipt(null);
    setHtmlBlobUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const data = await load(bookingId);
      if (requestId !== fetchIdRef.current) return;

      setReceipt(data);
      setLoading(false);

      try {
        const blob = await fetchReceiptHtmlBlob(bookingId, data.document_type);
        if (requestId !== fetchIdRef.current) return;
        setHtmlBlobUrl(URL.createObjectURL(blob));
      } catch (htmlErr) {
        if (requestId !== fetchIdRef.current) return;
        setHtmlError(
          getApiErrorDetail(htmlErr) ?? "Could not load the receipt preview.",
        );
      } finally {
        if (requestId === fetchIdRef.current) {
          setHtmlLoading(false);
        }
      }
    } catch (loadErr) {
      if (requestId !== fetchIdRef.current) return;
      setError(
        getApiErrorDetail(loadErr) ?? "Could not load this document. It may not be available yet.",
      );
      setReceipt(null);
      setLoading(false);
      setHtmlLoading(false);
    }
  }, [bookingId, load]);

  useEffect(() => {
    void fetchReceipt();
  }, [fetchReceipt]);

  useEffect(() => {
    return () => {
      if (htmlBlobUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(htmlBlobUrl);
      }
    };
  }, [htmlBlobUrl]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <BackLink href={backHref} label={backLabel} />
      {loading ? (
        <LoadingState label="Loading…" variant="centered" className="py-16" />
      ) : error ? (
        <LottieFailurePanel
          title="Document unavailable"
          description={error}
          action={
            <Link href={backHref} className="text-sm font-medium text-primary hover:underline">
              Back to booking
            </Link>
          }
        />
      ) : receipt ? (
        <div className="mt-6">
          <PaymentReceiptView
            receipt={receipt}
            htmlBlobUrl={htmlBlobUrl}
            htmlLoading={htmlLoading}
            htmlError={htmlError}
            onRetryPreview={() => void fetchReceipt()}
          />
        </div>
      ) : null}
    </div>
  );
}
