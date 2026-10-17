"use client";

import { useEffect, useState } from "react";
import { getApiErrorDetail, postBookingCheckout } from "@/lib/bookingCheckoutApi";
import { BOOKING_NOT_FOUND, COULD_NOT_START_CHECKOUT } from "@/lib/booking-messages";
import {
  fetchClientBookingDetail,
  patchClientBookingVenue,
} from "@/lib/clientBookingsApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { parseForm, payVenueSchema } from "@/lib/validation";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";
import {
  bookingCanBePaid,
  bookingNeedsVenue,
} from "@/features/client/payments/bookingPayHelpers";

export type ClientBookingPayPhase = "loading" | "venue" | "safety" | "redirecting" | "error";

/** Loads booking, collects venue if needed, shows payment safety modal, then Stripe Checkout. */
export function useClientBookingPay(bookingId: string | undefined) {
  const [phase, setPhase] = useState<ClientBookingPayPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [venueAddress, setVenueAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancellationPolicyLabel, setCancellationPolicyLabel] = useState<string | null>(null);
  const [cancellationPolicyLines, setCancellationPolicyLines] = useState<string[]>([]);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    void (async () => {
      try {
        const booking = await fetchClientBookingDetail(bookingId);
        if (cancelled) return;
        if (!bookingCanBePaid(booking)) {
          setError(PAYMENT_FLOW_COPY.payNotReady);
          setPhase("error");
          return;
        }
        setCancellationPolicyLabel(booking.cancellation_policy_label ?? null);
        setCancellationPolicyLines(booking.cancellation_policy_lines ?? []);
        if (bookingNeedsVenue(booking.event_address)) {
          setVenueAddress(booking.event_address ?? "");
          setPhase("venue");
          return;
        }
        setPhase("safety");
      } catch (e: unknown) {
        if (!cancelled) {
          setError(getApiErrorDetail(e) ?? BOOKING_NOT_FOUND);
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const proceedToCheckout = async () => {
    if (!bookingId) return;
    setBusy(true);
    setError(null);
    setPhase("redirecting");
    try {
      track(MixpanelEvents.booking_checkout_started, { booking_id: bookingId });
      const checkoutUrl = await postBookingCheckout(bookingId);
      window.location.href = checkoutUrl;
    } catch (e: unknown) {
      track(MixpanelEvents.booking_checkout_failed, { booking_id: bookingId });
      setError(getApiErrorDetail(e) ?? COULD_NOT_START_CHECKOUT);
      setPhase("error");
      setBusy(false);
    }
  };

  const continueFromVenue = async () => {
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
      setPhase("safety");
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "We couldn't save your venue address. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmSafetyAndPay = () => {
    void proceedToCheckout();
  };

  return {
    phase,
    error,
    venueAddress,
    setVenueAddress,
    busy,
    cancellationPolicyLabel,
    cancellationPolicyLines,
    continueFromVenue,
    confirmSafetyAndPay,
  };
}
