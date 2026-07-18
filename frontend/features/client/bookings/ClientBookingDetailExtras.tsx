"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { resolveWasClientTotalLabel } from "@/features/bookings/bookingPriceLabels";
import { BookingPriceUpdateBanner } from "@/features/bookings/BookingPriceUpdateBanner";
import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";
import type { ClientBookingDetail } from "@/lib/clientBookingsApi";

type ClientBookingDetailExtrasProps = {
  detail: ClientBookingDetail;
  showUpdatedPriceBanner: boolean;
  showCheckoutReturnBanner: boolean;
  checkoutReturnMessage: string;
  paymentBanner: string | null;
  paymentSyncError: string | null;
  showCancelledRefunded: boolean;
  paymentDue: boolean;
  paymentBannerRef: RefObject<HTMLDivElement | null>;
  actionBusy: boolean;
  confirmingCompletion: boolean;
  pendingPriceAction: null | "accept" | "decline";
  onAcceptUpdatedPrice: () => void;
  onDeclineUpdatedPrice: () => void;
  onConfirmComplete: () => void;
  onPayNow: () => void;
};

export function ClientBookingDetailExtras({
  detail,
  showUpdatedPriceBanner,
  showCheckoutReturnBanner,
  checkoutReturnMessage,
  paymentBanner,
  paymentSyncError,
  showCancelledRefunded,
  paymentDue,
  paymentBannerRef,
  actionBusy,
  confirmingCompletion,
  pendingPriceAction,
  onAcceptUpdatedPrice,
  onDeclineUpdatedPrice,
  onConfirmComplete,
  onPayNow,
}: ClientBookingDetailExtrasProps) {
  return (
    <>
      {showUpdatedPriceBanner ? (
        <BookingPriceUpdateBanner
          wasTotalLabel={resolveWasClientTotalLabel(detail)}
          nowTotalLabel={detail.pricing?.client_total_label ?? detail.total_label}
          pricing={detail.pricing}
          actionBusy={actionBusy}
          pendingAction={pendingPriceAction}
          onAccept={onAcceptUpdatedPrice}
          onDecline={onDeclineUpdatedPrice}
        />
      ) : null}

      {showCheckoutReturnBanner ? (
        <div
          className={`mt-4 rounded-xl border px-4 pb-4 pt-5 text-sm ${
            paymentBanner === "cancelled"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : paymentSyncError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {checkoutReturnMessage}
        </div>
      ) : null}

      <BookingCompletionBanner
        viewer="client"
        status={detail.status}
        paymentStatus={detail.payment_status}
        eventDate={detail.event_date}
        eventEndDate={detail.event_end_date}
        waitingOn={detail.completion_waiting_on}
        autoReleaseAt={detail.payout_auto_release_at}
        confirmDisabled={actionBusy || confirmingCompletion}
        onConfirm={onConfirmComplete}
      />

      {showCancelledRefunded ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 pb-4 pt-5 text-sm text-emerald-900">
          {PAYMENT_FLOW_COPY.cancelledRefunded}
        </div>
      ) : null}

      {paymentDue ? (
        <div
          ref={paymentBannerRef}
          className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 pb-4 pt-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-amber-950">Payment needed</p>
            <p className="mt-1 text-sm text-amber-900/90">Pay now to confirm your booking.</p>
            <p className="mt-1 text-xs text-amber-900/75">{PAYMENT_FLOW_COPY.beforePay}</p>
          </div>
          <Button variant="primary" size="md" className="shrink-0" onClick={onPayNow}>
            Pay now
          </Button>
        </div>
      ) : null}
    </>
  );
}
