"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  AddressFinderInput,
  type AddressFinderValue,
} from "@/components/ui/AddressFinderInput";
import { getApiErrorDetail, postBookingCheckout } from "@/lib/bookingCheckoutApi";
import {
  fetchClientBookingDetail,
  patchClientBookingVenue,
} from "@/lib/clientBookingsApi";

/** Collects venue details if needed, then redirects to Stripe Checkout. */
export default function ClientBookingPayPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const bookingId = params.bookingId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<AddressFinderValue>({ postcode: "", formattedAddress: null });
  const [needsVenue, setNeedsVenue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    void (async () => {
      try {
        const booking = await fetchClientBookingDetail(bookingId);
        if (cancelled) return;
        const hasAddress =
          Boolean(booking.event_postcode?.trim()) && Boolean(booking.event_address?.trim());
        if (hasAddress) {
          const checkoutUrl = await postBookingCheckout(bookingId);
          if (!cancelled) window.location.href = checkoutUrl;
          return;
        }
        setNeedsVenue(true);
        setVenue({
          postcode: booking.event_postcode ?? "",
          formattedAddress: booking.event_address,
        });
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
    const pc = venue.postcode.trim().replace(/\s+/g, " ");
    const addr = venue.formattedAddress?.trim();
    if (pc.length < 2 || !addr) {
      setError("Enter your full event postcode and pick a street address before paying.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchClientBookingVenue(bookingId, { event_postcode: pc, event_address: addr });
      const checkoutUrl = await postBookingCheckout(bookingId);
      window.location.href = checkoutUrl;
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not start checkout. Try again.");
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingState label="Preparing secure checkout…" variant="page" />;
  }

  if (needsVenue) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <h1 className="font-heading text-xl font-semibold text-neutral-900">Event address</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Before you pay, add the full venue address so your vendor knows where to deliver or set up.
        </p>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <div className="mt-6">
          <AddressFinderInput
            label="Venue location *"
            value={venue}
            disabled={busy}
            onChange={setVenue}
            placeholder="Postcode or address"
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
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
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => router.push(`/client/bookings/${encodeURIComponent(bookingId)}`)}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90"
          >
            Back to booking
          </button>
        </>
      ) : (
        <LoadingState label="Redirecting you to secure checkout…" variant="page" />
      )}
    </div>
  );
}
