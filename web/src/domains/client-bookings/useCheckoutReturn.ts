"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { platformErrorDetail } from "@/foundation/platform-client";
import {
  fetchClientBookingDetail,
  postClientBookingCheckoutSync,
  type ClientBookingDetail,
} from "@/domains/client-bookings/api";
import { PAYMENT_FLOW_COPY } from "@/domains/client-bookings/bookingCopy";
import { bookingCanBePaid } from "@/domains/client-bookings/bookingActions";
import {
  checkoutReturnBanner,
  clientBookingHref,
  paymentIsConfirmed,
  type CheckoutReturnBanner,
} from "@/domains/client-bookings/checkoutReturn";

/** A sync failure kept against the booking and session it belongs to. */
interface SyncFailure {
  key: string;
  message: string;
}

/**
 * Stripe's return on the booking detail page, ported from the baseline's
 * `useClientBookingPaymentReturn`.
 *
 * `payment=success` syncs once per booking and session, then re-fetches.
 * `payment=cancelled` only shows a banner. A booking left `pending` with no
 * return param gets one silent sync. Results after unmount are ignored.
 * Nothing here writes `payment_status`; the server does, after it has checked
 * with Stripe.
 */
export function useCheckoutReturn(
  bookingId: string,
  booking: ClientBookingDetail | null,
  replaceBooking: (nextBooking: ClientBookingDetail) => void,
): { banner: CheckoutReturnBanner; paymentDueRef: RefObject<HTMLDivElement | null> } {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentParam = searchParams.get("payment");
  const sessionId = searchParams.get("session_id");
  const paymentStatus = booking?.payment_status ?? null;
  const bookingLoaded = booking !== null;

  const paymentDueRef = useRef<HTMLDivElement>(null);
  const successSyncRef = useRef<string | null>(null);
  const pendingSyncRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [syncFailure, setSyncFailure] = useState<SyncFailure | null>(null);
  const paymentDue = booking !== null && bookingCanBePaid(booking);

  const syncKey = `${bookingId}:${sessionId ?? ""}`;
  const syncError = syncFailure?.key === syncKey ? syncFailure.message : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!paymentDue) return;
    paymentDueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [paymentDue, bookingId]);

  useEffect(() => {
    if (!bookingLoaded || paymentParam !== "success") return;
    if (!paymentIsConfirmed(paymentStatus)) return;
    router.replace(clientBookingHref(bookingId), { scroll: false });
  }, [bookingLoaded, paymentParam, paymentStatus, bookingId, router]);

  useEffect(() => {
    if (!bookingLoaded || paymentParam !== "success") return;
    if (paymentIsConfirmed(paymentStatus)) return;
    if (successSyncRef.current === syncKey) return;
    successSyncRef.current = syncKey;

    postClientBookingCheckoutSync(bookingId, sessionId)
      .then(() => fetchClientBookingDetail(bookingId))
      .then((fresh) => {
        if (!mountedRef.current) return;
        replaceBooking(fresh);
        router.replace(clientBookingHref(bookingId), { scroll: false });
      })
      .catch((cause: unknown) => {
        if (!mountedRef.current) return;
        setSyncFailure({
          key: syncKey,
          message: platformErrorDetail(cause) ?? PAYMENT_FLOW_COPY.paymentSyncPending,
        });
      });
  }, [bookingLoaded, paymentParam, paymentStatus, bookingId, sessionId, syncKey, replaceBooking, router]);

  useEffect(() => {
    if (!bookingLoaded || paymentParam) return;
    if (paymentStatus !== "pending") return;
    if (pendingSyncRef.current === bookingId) return;
    pendingSyncRef.current = bookingId;

    postClientBookingCheckoutSync(bookingId)
      .then(() => fetchClientBookingDetail(bookingId))
      .then((fresh) => {
        if (!mountedRef.current) return;
        if (paymentIsConfirmed(fresh.payment_status)) replaceBooking(fresh);
      })
      .catch(() => {
        // The webhook may still be in flight. The page already shows pending.
      });
  }, [bookingLoaded, paymentParam, paymentStatus, bookingId, replaceBooking]);

  return {
    banner: checkoutReturnBanner({ paymentParam, paymentStatus, syncError }),
    paymentDueRef,
  };
}
