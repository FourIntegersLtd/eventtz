"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientEzPageHead } from "@/features/client/ui/ClientEzPageHead";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { useClientBookingPay } from "@/features/client/payments/useClientBookingPay";
import { PaymentSafetyModal } from "@/features/client/payments/PaymentSafetyModal";
import { CLIENT_PAY_PAGE_COPY } from "@/features/bookings/bookingConfirmCopy";

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
    cancellationPolicyLabel,
    cancellationPolicyLines,
    continueFromVenue,
    confirmSafetyAndPay,
  } = useClientBookingPay(bookingId);

  const bookingHref = `/client/bookings/${encodeURIComponent(bookingId)}`;

  if (phase === "error") {
    return (
      <div className="ez-stack ez-stack--lg w-full max-w-3xl">
        <Link href={bookingHref} className="ez-back">Back to booking</Link>
        <LottieFailurePanel
          title="Payment couldn't be started"
          description={error ?? "Could not load this booking."}
          action={
            <button type="button" className="ez-btn ez-btn--secondary" onClick={() => router.push(bookingHref)}>
              Back to booking
            </button>
          }
        />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="ez-stack ez-stack--lg w-full max-w-3xl">
        <Link href={bookingHref} className="ez-back">Back to booking</Link>
        <LoadingState label="Preparing secure checkout…" variant="centered" className="py-16" branded />
      </div>
    );
  }

  if (phase === "venue") {
    return (
      <div className="ez-stack ez-stack--lg w-full max-w-3xl">
        <Link href={bookingHref} className="ez-back">Back to booking</Link>
        <ClientEzPageHead title={CLIENT_PAY_PAGE_COPY.venueTitle} description={CLIENT_PAY_PAGE_COPY.venueIntro} />
        {error ? (
          <LottieFailurePanel
            className="border-red-200 bg-red-50 py-6"
            title="Something went wrong"
            description={error}
          />
        ) : null}
        <label className="ez-field" htmlFor="pay-venue-address">
          <span className="ez-label">Venue address *</span>
          <textarea
            id="pay-venue-address"
            rows={3}
            value={venueAddress}
            disabled={busy}
            onChange={(e) => setVenueAddress(e.target.value)}
            placeholder="e.g. The Grand Hall, 12 Park Lane, London"
            className="ez-input"
          />
        </label>
        <div className="ez-hrow">
          <button
            type="button"
            className="ez-btn ez-btn--primary"
            disabled={busy}
            onClick={() => void continueFromVenue()}
          >
            {busy ? "Saving…" : "Continue"}
          </button>
          <button
            type="button"
            className="ez-btn ez-btn--secondary"
            disabled={busy}
            onClick={() => router.push(bookingHref)}
          >
            Back to booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ez-stack ez-stack--lg w-full max-w-3xl">
      <Link href={bookingHref} className="ez-back">Back to booking</Link>
      <ClientEzPageHead title="Pay to confirm your booking" description={CLIENT_PAY_PAGE_COPY.safetyIntro} />
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
          branded
        />
      ) : (
        null
      )}
      <PaymentSafetyModal
        isOpen={!error && (phase === "safety" || phase === "redirecting")}
        loading={busy || phase === "redirecting"}
        cancellationPolicyLabel={cancellationPolicyLabel}
        cancellationPolicyLines={cancellationPolicyLines}
        onConfirm={confirmSafetyAndPay}
        onCancel={() => router.push(bookingHref)}
      />
    </div>
  );
}
