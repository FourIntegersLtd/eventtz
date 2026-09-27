"use client";

import { useEffect, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { fetchClientBookings, type ClientBookingListItem } from "@/domains/client-bookings/api";
import { PAYMENT_ERROR_COPY } from "@/domains/client-bookings/bookingCopy";

/** One completed (or failed) payment-history fetch. */
interface PaymentsResult {
  bookings: ClientBookingListItem[];
  error: string | null;
}

/**
 * Loads every client booking that is not `unpaid` — the payment history.
 * `loading` is the absence of a result, so the effect never toggles a
 * loading flag of its own.
 */
export function useClientPayments() {
  const [result, setResult] = useState<PaymentsResult | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchClientBookings({ group: "all", excludePaymentStatus: "unpaid" })
      .then((bookings) => {
        if (!ignore) setResult({ bookings, error: null });
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setResult({
            bookings: [],
            error: platformErrorDetail(cause) ?? PAYMENT_ERROR_COPY.paymentHistoryFailed,
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  return {
    bookings: result?.bookings ?? [],
    loading: result === null,
    error: result?.error ?? null,
  };
}
