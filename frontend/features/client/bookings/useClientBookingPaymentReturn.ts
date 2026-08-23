"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApiErrorDetail, postBookingCheckoutSync } from "@/lib/bookingCheckoutApi";
import {
  fetchClientBookingDetail,
  type ClientBookingDetail,
} from "@/lib/clientBookingsApi";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";
import { bookingCanBePaid } from "@/features/client/payments/bookingPayHelpers";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

type UseClientBookingPaymentReturnArgs = {
  selectedBookingId?: string;
  detail: ClientBookingDetail | null;
  setDetail: (detail: ClientBookingDetail) => void;
  bumpDetail: () => void;
};

export function useClientBookingPaymentReturn({
  selectedBookingId,
  detail,
  setDetail,
  bumpDetail,
}: UseClientBookingPaymentReturnArgs) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentBannerRef = useRef<HTMLDivElement>(null);
  const pendingPaymentSyncRef = useRef<string | null>(null);
  const checkoutReturnSyncRef = useRef<string | null>(null);
  const paymentTrackedRef = useRef<string | null>(null);
  const [paymentSyncError, setPaymentSyncError] = useState<string | null>(null);

  const paymentBanner = searchParams.get("payment");
  const checkoutSessionId = searchParams.get("session_id");
  const paymentDue = detail ? bookingCanBePaid(detail) : false;
  const paymentConfirmed =
    detail?.payment_status === "paid" || detail?.payment_status === "payout_released";

  useEffect(() => {
    if (paymentDue) {
      paymentBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [paymentDue, detail?.booking_request_id]);

  useEffect(() => {
    pendingPaymentSyncRef.current = null;
    checkoutReturnSyncRef.current = null;
    paymentTrackedRef.current = null;
  }, [selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId || detail?.payment_status !== "pending") return;
    if (pendingPaymentSyncRef.current === selectedBookingId) return;
    pendingPaymentSyncRef.current = selectedBookingId;
    void postBookingCheckoutSync(selectedBookingId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (booking.payment_status === "paid" || booking.payment_status === "payout_released") {
          setDetail(booking);
          bumpDetail();
        }
      })
      .catch(() => {
        /* webhook may still be in flight, or checkout was abandoned */
      });
  }, [selectedBookingId, detail?.payment_status, bumpDetail, setDetail]);

  useEffect(() => {
    if (!selectedBookingId || !paymentBanner) return;
    const key = `${selectedBookingId}:${paymentBanner}`;
    if (paymentTrackedRef.current === key) return;
    if (paymentBanner === "cancelled") {
      paymentTrackedRef.current = key;
      track(MixpanelEvents.booking_payment_cancelled, { booking_id: selectedBookingId });
      return;
    }
    if (paymentBanner === "success" && paymentConfirmed) {
      paymentTrackedRef.current = key;
      track(MixpanelEvents.booking_payment_succeeded, { booking_id: selectedBookingId });
    }
  }, [selectedBookingId, paymentBanner, paymentConfirmed]);

  useEffect(() => {
    if (!selectedBookingId || paymentBanner !== "success") return;
    if (!paymentConfirmed) return;
    router.replace(`/client/bookings/${encodeURIComponent(selectedBookingId)}`, {
      scroll: false,
    });
  }, [selectedBookingId, paymentBanner, paymentConfirmed, router]);

  useEffect(() => {
    if (!selectedBookingId || paymentBanner !== "success") return;
    if (paymentConfirmed) return;

    const syncKey = `${selectedBookingId}:${checkoutSessionId ?? ""}`;
    if (checkoutReturnSyncRef.current === syncKey) return;
    checkoutReturnSyncRef.current = syncKey;

    let cancelled = false;
    setPaymentSyncError(null);
    void postBookingCheckoutSync(selectedBookingId, checkoutSessionId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (cancelled) return;
        setDetail(booking);
        bumpDetail();
        router.replace(`/client/bookings/${encodeURIComponent(selectedBookingId)}`, {
          scroll: false,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPaymentSyncError(
            getApiErrorDetail(e) ?? PAYMENT_FLOW_COPY.paymentSyncPending,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedBookingId,
    paymentBanner,
    checkoutSessionId,
    paymentConfirmed,
    router,
    setDetail,
    bumpDetail,
  ]);

  const showCheckoutReturnBanner =
    paymentBanner === "success" || paymentBanner === "cancelled";
  const checkoutReturnMessage =
    paymentBanner === "cancelled"
      ? PAYMENT_FLOW_COPY.paymentCancelledReturn
      : paymentSyncError
        ? paymentSyncError
        : paymentConfirmed
          ? PAYMENT_FLOW_COPY.paymentSuccess
          : PAYMENT_FLOW_COPY.paymentConfirming;

  return {
    paymentBanner,
    paymentSyncError,
    paymentConfirmed,
    paymentDue,
    paymentBannerRef,
    showCheckoutReturnBanner,
    checkoutReturnMessage,
  };
}
