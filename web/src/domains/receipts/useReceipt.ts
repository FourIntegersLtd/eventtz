"use client";

import { useEffect, useState } from "react";
import { isPlatformError, platformErrorDetail } from "@/foundation/platform-client";
import type { PaymentReceipt } from "@/domains/receipts/api";

interface ReceiptLoadResult {
  bookingId: string;
  receipt: PaymentReceipt | null;
  error: string | null;
}

/**
 * Loads one receipt document. `loading` is derived from whether the stored
 * result answers the current `bookingId`; the effect only updates state inside
 * the fetch promise handlers.
 */
export function useReceipt(bookingId: string, load: (id: string) => Promise<PaymentReceipt>) {
  const [result, setResult] = useState<ReceiptLoadResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(bookingId)
      .then((receipt) => {
        if (cancelled) return;
        setResult({ bookingId, receipt, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const detail = platformErrorDetail(cause);
        const fallback =
          isPlatformError(cause) && cause.status === 404
            ? "No receipt is available for this booking yet."
            : "Could not load receipt. Try again.";
        setResult({
          bookingId,
          receipt: null,
          error: detail ?? fallback,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, load]);

  const loading = result?.bookingId !== bookingId;

  return {
    receipt: result?.bookingId === bookingId ? result.receipt : null,
    error: result?.bookingId === bookingId ? result.error : null,
    loading,
  };
}
