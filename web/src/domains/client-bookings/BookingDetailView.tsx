"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Button, Card, ConfirmDialog, Spinner } from "@/foundation/ui";
import { useClientBookingDetail } from "@/domains/client-bookings/useClientBookingDetail";
import { toClientBookingDetailViewModel } from "@/domains/client-bookings/viewModel";
import {
  autoReleaseLine,
  clientBookingActions,
  completionBannerState,
  completionWaitingCopy,
} from "@/domains/client-bookings/bookingActions";
import { bookingStatusLabel, formatGbp, paymentStatusLabel } from "@/domains/client-bookings/format";
import { BookingStatusActions } from "@/domains/client-bookings/BookingStatusActions";
import { PriceUpdateBanner } from "@/domains/client-bookings/PriceUpdateBanner";
import { ClientReviewForm } from "@/domains/client-bookings/ClientReviewForm";
import { ReviewSummaryCard } from "@/domains/client-bookings/ReviewSummaryCard";
import { clientBookingHref, type CheckoutReturnTone } from "@/domains/client-bookings/checkoutReturn";
import { useCheckoutReturn } from "@/domains/client-bookings/useCheckoutReturn";
import {
  BOOKING_CONFIRM_COPY,
  BOOKING_OUTCOME_COPY,
  PAYMENT_FLOW_COPY,
  cancelConfirmCopy,
} from "@/domains/client-bookings/bookingCopy";

/** Which confirmation dialog is open, if any. */
type OpenDialog = "cancel" | "declineQuote" | "declinePriceUpdate" | "confirmCompletion" | null;

/**
 * `/client/bookings/[bookingId]` — one booking's full detail, with its status,
 * pay and review actions. Anything hard to undo (cancel, decline, confirm
 * completion) goes through a confirmation dialog first, as in the baseline.
 */
export function BookingDetailView({ bookingId }: { bookingId: string }) {
  const {
    booking,
    loading,
    loadError,
    actionError,
    pendingAction,
    cancel,
    respondToQuote,
    respondToPriceUpdate,
    confirmCompletion,
    submitReview,
    replaceBooking,
  } = useClientBookingDetail(bookingId);
  const { banner, paymentDueRef } = useCheckoutReturn(bookingId, booking, replaceBooking);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  /** Runs a confirmed action and closes its dialog only if it succeeded, so a failure stays visible. */
  async function runConfirmed(action: () => Promise<boolean>) {
    if (await action()) setOpenDialog(null);
  }

  if (loading) return <Spinner label="Loading booking…" />;

  if (loadError || !booking) {
    return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{loadError ?? "Booking not found."}</p>;
  }

  const model = toClientBookingDetailViewModel(booking, booking.vendor_display_name, `/client/browse/${booking.vendor_user_id}`);
  const actions = clientBookingActions(booking);
  const completionBanner = completionBannerState(booking);
  const cancelCopy = cancelConfirmCopy(booking.payment_status);

  return (
    <div className="space-y-4">
      <Link href="/client/bookings" className="inline-block text-sm font-medium text-neutral-500 hover:text-primary">
        ← Back to bookings
      </Link>

      <ConfirmDialog
        isOpen={openDialog === "cancel"}
        {...cancelCopy}
        destructive
        loading={pendingAction === "cancel"}
        onCancel={() => setOpenDialog(null)}
        onConfirm={() => void runConfirmed(cancel)}
      />
      <ConfirmDialog
        isOpen={openDialog === "declineQuote"}
        {...BOOKING_CONFIRM_COPY.declineQuote}
        destructive
        loading={pendingAction === "declineQuote"}
        onCancel={() => setOpenDialog(null)}
        onConfirm={() => void runConfirmed(() => respondToQuote("declined"))}
      />
      <ConfirmDialog
        isOpen={openDialog === "declinePriceUpdate"}
        {...BOOKING_CONFIRM_COPY.declineUpdatedPrice}
        destructive
        loading={pendingAction === "declinePriceUpdate"}
        onCancel={() => setOpenDialog(null)}
        onConfirm={() => void runConfirmed(() => respondToPriceUpdate("declined"))}
      />
      <ConfirmDialog
        isOpen={openDialog === "confirmCompletion"}
        {...BOOKING_CONFIRM_COPY.confirmComplete}
        loading={pendingAction === "confirmCompletion"}
        onCancel={() => setOpenDialog(null)}
        onConfirm={() => void runConfirmed(confirmCompletion)}
      />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{model.eventName}</h2>
            <p className="text-sm text-neutral-500">{model.eventDateLabel}</p>
            <p className="mt-1 text-sm text-neutral-600">{model.timelineLabel}</p>
            <p className="mt-1 text-sm text-neutral-600">
              <Link href={model.counterpartyHref} className="font-medium text-primary hover:underline">
                {model.counterpartyName}
              </Link>
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-neutral-900">{model.totalLabel}</p>
            <p className="text-xs font-medium text-primary">{bookingStatusLabel(model.status)}</p>
            <p className="mt-1 text-xs text-neutral-500">{paymentStatusLabel(booking.payment_status)}</p>
          </div>
        </div>

        {model.venueAddress || model.venuePostcode ? (
          <p className="mt-3 text-sm text-neutral-600">{[model.venueAddress, model.venuePostcode].filter(Boolean).join(", ")}</p>
        ) : null}

        {model.notes ? (
          <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
            <p className="text-xs font-medium text-neutral-500">{model.notesLabel}</p>
            <p className="mt-1 whitespace-pre-wrap">{model.notes}</p>
          </div>
        ) : null}

        <div className="mt-4">
          <BookingStatusActions
            booking={booking}
            pendingAction={pendingAction}
            onAcceptQuote={() => void respondToQuote("accepted")}
            onDeclineQuote={() => setOpenDialog("declineQuote")}
            onCancel={() => setOpenDialog("cancel")}
            onConfirmCompletion={() => setOpenDialog("confirmCompletion")}
          />
        </div>

        {actionError ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{actionError}</p>
        ) : null}

        {actions.showUpdatedPriceBanner ? (
          <PriceUpdateBanner
            booking={booking}
            busy={pendingAction !== null}
            accepting={pendingAction === "acceptPriceUpdate"}
            onAccept={() => void respondToPriceUpdate("accepted")}
            onDecline={() => setOpenDialog("declinePriceUpdate")}
          />
        ) : null}

        {actions.showCancelledRefunded ? (
          <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200/60">
            {PAYMENT_FLOW_COPY.cancelledRefunded}
          </div>
        ) : null}

        {booking.booking_status === "declined" ? (
          <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200/60">
            {BOOKING_OUTCOME_COPY.declined}
          </div>
        ) : null}

        {banner.show ? <CheckoutReturnBanner tone={banner.tone} message={banner.message} /> : null}

        {completionBanner ? (
          <CompletionWaitingBanner
            waitingOn={completionBanner.waitingOn}
            autoReleaseAt={booking.payout_auto_release_at}
            onConfirm={completionBanner.clientNeedsToConfirm ? () => setOpenDialog("confirmCompletion") : undefined}
            confirmDisabled={pendingAction !== null}
          />
        ) : null}

        {actions.isPayoutReleasePending ? (
          <div className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary ring-1 ring-primary-border">
            <p className="font-semibold">{PAYMENT_FLOW_COPY.payoutPendingClient.title}</p>
            <p className="mt-1">{PAYMENT_FLOW_COPY.payoutPendingClient.body}</p>
          </div>
        ) : null}

        {actions.paymentDue ? (
          <div ref={paymentDueRef} className="mt-4 rounded-xl bg-primary-soft px-4 py-3 ring-1 ring-primary-border">
            <p className="font-semibold text-primary">{PAYMENT_FLOW_COPY.paymentDueTitle}</p>
            <p className="mt-1 text-sm text-primary">{PAYMENT_FLOW_COPY.paymentDueSubtitle}</p>
            <p className="mt-2 text-sm text-neutral-700">{PAYMENT_FLOW_COPY.beforePay}</p>
            <Link
              href={`${clientBookingHref(bookingId)}/pay`}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {PAYMENT_FLOW_COPY.payNowLabel}
            </Link>
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="font-semibold text-neutral-900">Line items</h3>
        <ul className="mt-3 space-y-2">
          {model.lineItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700">
                {item.heading}
                {item.quantity ? ` × ${item.quantity}${item.unitLabel ? ` ${item.unitLabel}` : ""}` : ""}
              </span>
              {item.unitPriceGbp !== null ? <span className="font-medium text-neutral-900">{formatGbp(item.unitPriceGbp)}</span> : null}
            </li>
          ))}
        </ul>

        {booking.vendor_adjustments && booking.vendor_adjustments.length > 0 ? (
          <div className="mt-4 space-y-2 border-t border-primary-border pt-3">
            {booking.vendor_adjustments.map((adjustment) => (
              <div key={adjustment.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">{adjustment.label}</span>
                <span className="font-medium text-neutral-900">{formatGbp(adjustment.amount_gbp)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {model.pricing ? (
          <div className="mt-4 space-y-1 border-t border-primary-border pt-3 text-sm">
            {model.pricing.referral_fee_discount_label ? (
              <div className="flex items-center justify-between text-neutral-600">
                <span>Referral discount</span>
                <span>{model.pricing.referral_fee_discount_label}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">Service fee</span>
              <span className="text-neutral-900">{model.pricing.service_fee_label}</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span className="text-neutral-900">Client total</span>
              <span className="text-neutral-900">{model.pricing.client_total_label}</span>
            </div>
          </div>
        ) : null}
      </Card>

      {booking.review ? (
        <ReviewSummaryCard review={booking.review} />
      ) : booking.booking_status === "completed" ? (
        <Card>
          <h3 className="font-semibold text-neutral-900">Leave a review</h3>
          <p className="mt-1 text-sm text-neutral-500">How was your experience with {model.counterpartyName}?</p>
          <div className="mt-3">
            <Suspense fallback={<Spinner label="Loading review form…" />}>
              <ClientReviewForm saving={pendingAction === "submitReview"} onSubmit={(body) => void submitReview(body)} />
            </Suspense>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

const CHECKOUT_RETURN_TONE_CLASS: Record<CheckoutReturnTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  red: "border-red-200 bg-red-50 text-red-800",
  green: "border-emerald-100 bg-emerald-50/60 text-neutral-800",
};

/** Stripe return banner: cancelled, confirming, paid, or a sync that failed. */
function CheckoutReturnBanner({ tone, message }: { tone: CheckoutReturnTone; message: string }) {
  return (
    <div className={`mt-4 rounded-2xl border px-5 py-4 text-sm ${CHECKOUT_RETURN_TONE_CLASS[tone]}`}>{message}</div>
  );
}

/**
 * Post-event banner telling the client who we're waiting on and the
 * auto-release date, with "Confirm event complete" while the client still owes
 * a confirmation (the baseline's `BookingCompletionBanner`).
 */
function CompletionWaitingBanner({
  waitingOn,
  autoReleaseAt,
  onConfirm,
  confirmDisabled,
}: {
  waitingOn: "client" | "vendor" | "both";
  autoReleaseAt?: string | null;
  onConfirm?: () => void;
  confirmDisabled: boolean;
}) {
  const copy = completionWaitingCopy(waitingOn, "client");
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm ring-1 ring-primary-border sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-neutral-900">{copy.title}</p>
        <p className="mt-1 text-neutral-600">{copy.body}</p>
        {autoReleaseAt ? <p className="mt-1 text-neutral-500">{autoReleaseLine(autoReleaseAt, "client")}</p> : null}
      </div>
      {onConfirm ? (
        <Button className="shrink-0" disabled={confirmDisabled} onClick={onConfirm}>
          Confirm event complete
        </Button>
      ) : null}
    </div>
  );
}
