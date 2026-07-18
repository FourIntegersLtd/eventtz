"use client";

import { BackLink } from "@/components/ui/BackLink";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";
import { useClientBookingPay } from "@/features/client/payments/useClientBookingPay";

type ClientBookingPayViewProps = {
  bookingId: string;
};

/** Collects venue details if needed, then redirects to Stripe Checkout. */
export function ClientBookingPayView({ bookingId }: ClientBookingPayViewProps) {
  const router = useRouter();
  const {
    loading,
    error,
    venueAddress,
    setVenueAddress,
    needsVenue,
    busy,
    continueToCheckout,
  } = useClientBookingPay(bookingId);

  const bookingHref = `/client/bookings/${encodeURIComponent(bookingId)}`;

  if (loading) {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink href={bookingHref} label="Back to booking" />
        <LoadingState label="Preparing secure checkout…" variant="centered" className="py-16" />
      </div>
    );
  }

  if (needsVenue) {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink href={bookingHref} label="Back to booking" />
        <header>
          <h1 className="font-heading text-xl font-semibold text-neutral-900">Event location</h1>
          <p className="mt-2 text-sm text-neutral-600">Where is the event?</p>
        </header>
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          {PAYMENT_FLOW_COPY.beforePay}
        </p>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
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
            onChange={(e) => setVenueAddress(e.target.value)}
            placeholder="e.g. The Grand Hall, 12 Park Lane, London"
            className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-50 disabled:text-neutral-500"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" loading={busy} onClick={() => void continueToCheckout()}>
            Continue to payment
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => router.push(bookingHref)}
          >
            Back to booking
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      {error ? (
        <>
          <BackLink href={bookingHref} label="Back to booking" />
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="secondary" onClick={() => router.push(bookingHref)}>
            Back to booking
          </Button>
        </>
      ) : (
        <>
          <BackLink href={bookingHref} label="Back to booking" />
          <LoadingState
            label="Redirecting you to secure checkout…"
            variant="centered"
            className="py-16"
          />
        </>
      )}
    </div>
  );
}
