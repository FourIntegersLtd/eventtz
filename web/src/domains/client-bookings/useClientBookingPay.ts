"use client";

import { useEffect, useRef, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import {
  fetchClientBookingDetail,
  patchClientBookingVenue,
  postClientBookingCheckout,
} from "@/domains/client-bookings/api";
import { PAYMENT_ERROR_COPY, PAYMENT_FLOW_COPY } from "@/domains/client-bookings/bookingCopy";
import { initialPayPhase } from "@/domains/client-bookings/payPhase";
import { parseVenueForm, toUpdateVenueBody } from "@/domains/client-bookings/venueForm";

export type ClientBookingPayPhase = "loading" | "venue" | "safety" | "redirecting" | "error";

/** One loaded pay screen, tagged with the booking id it belongs to. */
interface PaySnapshot {
  bookingId: string;
  phase: Exclude<ClientBookingPayPhase, "loading">;
  error: string | null;
  venueAddress: string;
  busy: boolean;
}

/**
 * Loads a booking and walks the pay steps: venue (when the address is
 * missing), the safety modal, then Stripe Checkout.
 *
 * Checkout is never started from this effect or retried. Only
 * `confirmSafetyAndPay` posts it, and a ref blocks a second click before
 * React has re-rendered the disabled button.
 *
 * `loading` is derived from whether the snapshot answers the current
 * `bookingId`. Every `setState` sits in a fetch `.then`/`.catch` or in an
 * event handler, so the effect body itself does not set state.
 */
export function useClientBookingPay(bookingId: string) {
  const [snapshot, setSnapshot] = useState<PaySnapshot | null>(null);
  const checkoutStartedRef = useRef(false);

  useEffect(() => {
    let ignore = false;
    fetchClientBookingDetail(bookingId)
      .then((booking) => {
        if (ignore) return;
        const phase = initialPayPhase(booking);
        if (phase === "notPayable") {
          setSnapshot({
            bookingId,
            phase: "error",
            error: PAYMENT_FLOW_COPY.payNotReady,
            venueAddress: "",
            busy: false,
          });
          return;
        }
        setSnapshot({
          bookingId,
          phase,
          error: null,
          venueAddress: booking.event_address ?? "",
          busy: false,
        });
      })
      .catch((cause: unknown) => {
        if (ignore) return;
        setSnapshot({
          bookingId,
          phase: "error",
          error: platformErrorDetail(cause) ?? PAYMENT_ERROR_COPY.bookingNotFound,
          venueAddress: "",
          busy: false,
        });
      });
    return () => {
      ignore = true;
    };
  }, [bookingId]);

  const ready = snapshot !== null && snapshot.bookingId === bookingId;

  function setVenueAddress(venueAddress: string) {
    setSnapshot((current) => {
      if (!current || current.bookingId !== bookingId) return current;
      return { ...current, venueAddress };
    });
  }

  function continueFromVenue() {
    if (!ready || !snapshot || snapshot.busy || snapshot.phase !== "venue") return;
    const parsed = parseVenueForm({ eventAddress: snapshot.venueAddress });
    if (!parsed.ok) {
      setSnapshot({ ...snapshot, error: parsed.formError });
      return;
    }
    const venueAddress = snapshot.venueAddress;
    setSnapshot({ ...snapshot, busy: true, error: null });
    patchClientBookingVenue(bookingId, toUpdateVenueBody(parsed.data))
      .then(() => {
        setSnapshot({
          bookingId,
          phase: "safety",
          error: null,
          venueAddress: parsed.data.eventAddress,
          busy: false,
        });
      })
      .catch((cause: unknown) => {
        setSnapshot({
          bookingId,
          phase: "venue",
          error: platformErrorDetail(cause) ?? PAYMENT_ERROR_COPY.venueSaveFailed,
          venueAddress,
          busy: false,
        });
      });
  }

  function confirmSafetyAndPay() {
    if (!ready || !snapshot || snapshot.busy || checkoutStartedRef.current) return;
    checkoutStartedRef.current = true;
    const venueAddress = snapshot.venueAddress;
    setSnapshot({ ...snapshot, busy: true, error: null, phase: "redirecting" });
    postClientBookingCheckout(bookingId)
      .then((checkoutUrl) => {
        window.location.assign(checkoutUrl);
      })
      .catch((cause: unknown) => {
        checkoutStartedRef.current = false;
        setSnapshot({
          bookingId,
          phase: "error",
          error: platformErrorDetail(cause) ?? PAYMENT_ERROR_COPY.checkoutFailed,
          venueAddress,
          busy: false,
        });
      });
  }

  return {
    phase: (ready ? snapshot.phase : "loading") as ClientBookingPayPhase,
    error: ready ? snapshot.error : null,
    venueAddress: ready ? snapshot.venueAddress : "",
    setVenueAddress,
    busy: ready ? snapshot.busy : false,
    continueFromVenue,
    confirmSafetyAndPay,
  };
}
