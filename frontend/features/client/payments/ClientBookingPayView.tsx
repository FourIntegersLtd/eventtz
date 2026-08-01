"use client";

import { BackLink } from "@/components/ui/BackLink";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { useClientBookingPay } from "@/features/client/payments/useClientBookingPay";
import { PaymentSafetyModal } from "@/features/client/payments/PaymentSafetyModal";

type ClientBookingPayViewProps = {
  bookingId: string;
};

/** Collects venue details if needed, shows payment protection modal, then Stripe Checkout. */
export function ClientBookingPayView({ bookingId }: ClientBookingPayViewProps) {
  const router = useRouter();
  const {
    phase,
    error,
    venueAddress,
    setVenueAddress,
    busy,
    continueFromVenue,
    confirmSafetyAndPay,
  } = useClientBookingPay(bookingId);

  const bookingHref = `/client/bookings/${encodeURIComponent(bookingId)}`;

  if (phase === "error") {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink href={bookingHref} label="Back to booking" />
        <LottieFailurePanel
          title="Payment couldn't be started"
          description={error ?? "Could not load this booking."}
          action={
            <Button variant="secondary" onClick={() => router.push(bookingHref)}>
              Back to booking
            </Button>
          }
        />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink href={bookingHref} label="Back to booking" />
        <LoadingState label="Preparing secure checkout…" variant="centered" className="py-16" lottie="paymentSecure" />
      </div>
    );
  }

  if (phase === "venue") {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink href={bookingHref} label="Back to booking" />
        <header>
          <h1 className="font-heading text-xl font-semibold text-neutral-900">Event location</h1>
          <p className="mt-2 text-sm text-neutral-600">
            We need your event address before you pay. You will see how we protect your payment on
            the next step.
          </p>
        </header>
        {error ? (
          <LottieFailurePanel
            className="border-red-200 bg-red-50 py-6"
            title="Something went wrong"
            description={error}
          />
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
          <Button variant="primary" loading={busy} onClick={() => void continueFromVenue()}>
            Continue
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
      <BackLink href={bookingHref} label="Back to booking" />
      {error && phase !== "redirecting" ? (
        <LottieFailurePanel
          className="border-red-200 bg-red-50 py-6"
          title="Checkout failed"
          description={error}
        />
      ) : null}
      {phase === "redirecting" ? (
        <LoadingState
          label="Redirecting you to secure checkout…"
          variant="centered"
          className="py-16"
          lottie="paymentSecure"
        />
      ) : (
        <p className="text-sm text-neutral-600">Review how we protect your payment, then continue.</p>
      )}
      <PaymentSafetyModal
        isOpen={phase === "safety" || phase === "redirecting"}
        loading={busy || phase === "redirecting"}
        onConfirm={confirmSafetyAndPay}
        onCancel={() => router.push(bookingHref)}
      />
    </div>
  );
}
