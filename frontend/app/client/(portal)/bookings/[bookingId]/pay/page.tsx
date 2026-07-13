"use client";

import { BackLink } from "@/components/ui/BackLink";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { getApiErrorDetail, postBookingCheckout } from "@/lib/bookingCheckoutApi";
import {
  fetchClientBookingDetail,
  patchClientBookingVenue,
} from "@/lib/clientBookingsApi";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";

/** Collects venue details if needed, then redirects to Stripe Checkout. */
export default function ClientBookingPayPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const bookingId = params.bookingId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venueAddress, setVenueAddress] = useState("");
  const [needsVenue, setNeedsVenue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    void (async () => {
      try {
        const booking = await fetchClientBookingDetail(bookingId);
        if (cancelled) return;
        if (Boolean(booking.event_address?.trim())) {
          const checkoutUrl = await postBookingCheckout(bookingId);
          if (!cancelled) window.location.href = checkoutUrl;
          return;
        }
        setNeedsVenue(true);
        setVenueAddress(booking.event_address ?? "");
      } catch (e: unknown) {
        if (!cancelled) {
          setError(getApiErrorDetail(e) ?? "Could not load this booking.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const continueToCheckout = async () => {
    if (!bookingId) return;
    const addr = venueAddress.trim();
    if (addr.length < 3) {
      setError("Enter the venue address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchClientBookingVenue(bookingId, { event_address: addr });
      const checkoutUrl = await postBookingCheckout(bookingId);
      window.location.href = checkoutUrl;
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not start checkout. Try again.");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink
          href={`/client/bookings/${encodeURIComponent(bookingId)}`}
          label="Back to booking"
        />
        <LoadingState label="Preparing secure checkout…" variant="centered" className="py-16" />
      </div>
    );
  }

  if (needsVenue) {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink
          href={`/client/bookings/${encodeURIComponent(bookingId)}`}
          label="Back to booking"
        />
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
            onClick={() => router.push(`/client/bookings/${encodeURIComponent(bookingId)}`)}
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
          <BackLink
            href={`/client/bookings/${encodeURIComponent(bookingId)}`}
            label="Back to booking"
          />
          <p className="text-sm text-red-700">{error}</p>
          <Button
            variant="secondary"
            onClick={() => router.push(`/client/bookings/${encodeURIComponent(bookingId)}`)}
          >
            Back to booking
          </Button>
        </>
      ) : (
        <>
          <BackLink
            href={`/client/bookings/${encodeURIComponent(bookingId)}`}
            label="Back to booking"
          />
          <LoadingState label="Redirecting you to secure checkout…" variant="centered" className="py-16" />
        </>
      )}
    </div>
  );
}
