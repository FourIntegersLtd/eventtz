"use client";

import { useEffect, useId } from "react";
import { Button } from "@/foundation/ui";
import { PAYMENT_SAFETY_COPY } from "@/domains/client-bookings/bookingCopy";

/**
 * Last step before Stripe Checkout: how the payment is held, and the 48-hour
 * window to report a problem. Closing is blocked while checkout is starting
 * so a dismiss cannot race the redirect.
 */
export function PaymentSafetyModal({
  isOpen,
  loading = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  function requestClose() {
    if (!loading) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 p-4 sm:items-center"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-neutral-900">
          {PAYMENT_SAFETY_COPY.modalTitle}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-700">
          <p>{PAYMENT_SAFETY_COPY.intro}</p>
          <ul className="list-disc space-y-2 pl-5">
            {PAYMENT_SAFETY_COPY.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={loading} onClick={requestClose}>
            {PAYMENT_SAFETY_COPY.cancelLabel}
          </Button>
          <Button type="button" loading={loading} onClick={onConfirm}>
            {PAYMENT_SAFETY_COPY.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
