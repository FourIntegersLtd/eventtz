"use client";

import { useEffect, useState } from "react";
import { getApiErrorDetail, postBookingCheckout } from "@/lib/bookingCheckoutApi";
import {
  fetchClientBookingDetail,
  patchClientBookingVenue,
} from "@/lib/clientBookingsApi";
import { parseForm, payVenueSchema } from "@/lib/validation";
import { bookingNeedsVenue } from "@/features/client/payments/bookingPayHelpers";

/** Loads booking, redirects to Checkout when venue exists, or collects venue first. */
export function useClientBookingPay(bookingId: string | undefined) {
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
        if (!bookingNeedsVenue(booking.event_address)) {
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
    const parsed = parseForm(payVenueSchema, { eventAddress: venueAddress });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchClientBookingVenue(bookingId, { event_address: parsed.data.eventAddress });
      const checkoutUrl = await postBookingCheckout(bookingId);
      window.location.href = checkoutUrl;
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "We couldn't start payment. Please try again.");
      setBusy(false);
    }
  };

  return {
    loading,
    error,
    venueAddress,
    setVenueAddress,
    needsVenue,
    busy,
    continueToCheckout,
  };
}
