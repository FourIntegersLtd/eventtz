"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button, Card, Spinner } from "@/foundation/ui";
import { CLIENT_PAY_PAGE_COPY, PAYMENT_ERROR_COPY } from "@/domains/client-bookings/bookingCopy";
import { clientBookingHref } from "@/domains/client-bookings/checkoutReturn";
import { PaymentSafetyModal } from "@/domains/client-bookings/PaymentSafetyModal";
import { useClientBookingPay } from "@/domains/client-bookings/useClientBookingPay";

/**
 * `/client/bookings/[bookingId]/pay` — venue when needed, then the payment
 * safety modal, then Stripe. The only way into Checkout is the modal's
 * confirm button.
 */
export function BookingPayView({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { phase, error, venueAddress, setVenueAddress, busy, continueFromVenue, confirmSafetyAndPay } =
    useClientBookingPay(bookingId);
  const bookingHref = clientBookingHref(bookingId);

  return (
    <PayFrame bookingHref={bookingHref}>
      {phase === "loading" ? (
        <div className="flex justify-center py-16">
          <Spinner label="Preparing secure checkout…" />
        </div>
      ) : null}

      {phase === "error" ? (
        <Card>
          <h1 className="font-heading text-lg font-semibold text-neutral-900">Payment couldn&apos;t be started</h1>
          <p className="mt-2 text-sm text-neutral-600">{error ?? PAYMENT_ERROR_COPY.bookingNotFound}</p>
          <div className="mt-4">
            <Button type="button" variant="secondary" onClick={() => router.push(bookingHref)}>
              Back to booking
            </Button>
          </div>
        </Card>
      ) : null}

      {phase === "venue" ? (
        <>
          <header>
            <h1 className="font-heading text-xl font-semibold text-neutral-900">{CLIENT_PAY_PAGE_COPY.venueTitle}</h1>
            <p className="mt-2 text-sm text-neutral-600">{CLIENT_PAY_PAGE_COPY.venueIntro}</p>
          </header>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6">
              <p className="font-semibold text-neutral-900">Something went wrong</p>
              <p className="mt-1 text-sm text-red-800">{error}</p>
            </div>
          ) : null}
          <div>
            <label
              htmlFor="pay-venue-address"
              className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              Venue address *
            </label>
            <textarea
              id="pay-venue-address"
              rows={3}
              value={venueAddress}
              disabled={busy}
              onChange={(event) => setVenueAddress(event.target.value)}
              placeholder="e.g. The Grand Hall, 12 Park Lane, London"
              className="mt-1.5 w-full resize-y rounded-xl border border-primary-border px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-primary-border disabled:bg-neutral-50 disabled:text-neutral-500"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" loading={busy} onClick={continueFromVenue}>
              Continue
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => router.push(bookingHref)}>
              Back to booking
            </Button>
          </div>
        </>
      ) : null}

      {(phase === "safety" || phase === "redirecting") ? (
        <>
          {phase === "redirecting" ? (
            <div className="flex justify-center py-16">
              <Spinner label="Redirecting you to secure checkout…" />
            </div>
          ) : (
            <p className="text-sm text-neutral-600">{CLIENT_PAY_PAGE_COPY.safetyIntro}</p>
          )}
          <PaymentSafetyModal
            isOpen={error === null && (phase === "safety" || phase === "redirecting")}
            loading={busy || phase === "redirecting"}
            onConfirm={confirmSafetyAndPay}
            onCancel={() => router.push(bookingHref)}
          />
        </>
      ) : null}
    </PayFrame>
  );
}

/** Shared width and the back link shown on every pay-page phase. */
function PayFrame({ bookingHref, children }: { bookingHref: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link href={bookingHref} className="inline-block text-sm font-medium text-neutral-500 hover:text-primary">
        ← Back to booking
      </Link>
      {children}
    </div>
  );
}
