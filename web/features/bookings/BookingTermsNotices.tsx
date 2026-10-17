"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  canConfirmDelivery,
  canReportDeposit,
  deliveryDueLine,
  depositClaimError,
  depositStateLine,
  paymentDeadlineLine,
  vendorSplitStatusLine,
  DEPOSIT_NOTE_MAX_CHARS,
} from "@/features/bookings/bookingTerms";
import { postClientConfirmDelivery, type ClientBookingDetail } from "@/lib/clientBookingsApi";
import { postVendorDepositClaim, type VendorBookingDetail } from "@/lib/vendorBookingsApi";
import { withMutationFeedback } from "@/lib/mutationFeedback";
import { formatGbp } from "@/lib/vendorDiscountDisplay";

function NoticeCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50 px-5 py-4">
      {title ? <p className="text-sm font-semibold text-neutral-900">{title}</p> : null}
      <div className={`${title ? "mt-1 " : ""}text-[13px] text-neutral-600`}>{children}</div>
    </div>
  );
}

/**
 * Client-side booking-rule notices: payment deadline, delivery confirmation
 * for split-payout bookings, and the damage-deposit state.
 */
export function ClientBookingTermsNotices({
  detail,
  onChanged,
}: {
  detail: ClientBookingDetail;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const deadline = paymentDeadlineLine("client", detail.payment_due_at, detail.payment_status);
  const depositLine = depositStateLine(detail);

  const confirmDelivery = async () => {
    setConfirming(true);
    const ok = await withMutationFeedback(showToast, {
      successTitle: "Delivery confirmed",
      successDescription: "Thanks. The rest of the vendor's payment has been released.",
      errorTitle: "Couldn't confirm delivery",
      run: () => postClientConfirmDelivery(detail.booking_request_id),
    });
    setConfirming(false);
    if (ok !== null) onChanged();
  };

  return (
    <>
      {deadline ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
          {deadline}
        </div>
      ) : null}
      {canConfirmDelivery(detail) ? (
        <NoticeCard title="Have your photos/video arrived?">
          <p>
            {detail.upfront_amount_gbp != null
              ? `£${formatGbp(detail.upfront_amount_gbp)} has already been paid to the vendor. `
              : ""}
            Confirm once you have received them and the rest is released.
          </p>
          {deliveryDueLine(detail.delivery_due_at) ? (
            <p className="mt-1 text-neutral-500">{deliveryDueLine(detail.delivery_due_at)}</p>
          ) : null}
          <Button
            className="mt-3"
            variant="primary"
            size="md"
            loading={confirming}
            onClick={() => void confirmDelivery()}
          >
            Confirm I&apos;ve received my photos/video
          </Button>
        </NoticeCard>
      ) : null}
      {depositLine ? <NoticeCard title="Refundable deposit">{depositLine}</NoticeCard> : null}
    </>
  );
}

/**
 * Vendor-side booking-rule notices: client payment deadline, split payout
 * status, deposit state and the "Report damage or missing items" form.
 */
export function VendorBookingTermsNotices({
  detail,
  onChanged,
}: {
  detail: VendorBookingDetail;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const deadline = paymentDeadlineLine("vendor", detail.payment_due_at, detail.payment_status);
  const splitLine = vendorSplitStatusLine(detail);
  const depositLine = depositStateLine(detail);
  const deposit = detail.damage_deposit_gbp ?? 0;

  const submitClaim = async () => {
    const error = depositClaimError(amount, note, deposit);
    setFormError(error);
    if (error) return;
    setSubmitting(true);
    const ok = await withMutationFeedback(showToast, {
      successTitle: "Damage report sent",
      successDescription: "Our team will review it and decide how much of the deposit you keep.",
      errorTitle: "Couldn't send report",
      run: () =>
        postVendorDepositClaim(detail.booking_request_id, {
          amount_gbp: Number(amount),
          note: note.trim(),
        }),
    });
    setSubmitting(false);
    if (ok !== null) {
      setAmount("");
      setNote("");
      onChanged();
    }
  };

  return (
    <>
      {deadline ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
          {deadline}
        </div>
      ) : null}
      {splitLine ? <NoticeCard title="Split payment">{splitLine}</NoticeCard> : null}
      {depositLine ? <NoticeCard title="Client's refundable deposit">{depositLine}</NoticeCard> : null}
      {canReportDeposit(detail) ? (
        <NoticeCard title="Report damage or missing items">
          <p>
            You can keep up to £{formatGbp(deposit)} of the deposit if something was damaged or missing.
            Report it before the deposit is returned
            {detail.deposit_refund_due_at ? " on the date above" : ""}.
          </p>
          <div className="mt-3 space-y-3">
            <label className="block text-sm text-neutral-800">
              Amount to claim (£)
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                placeholder={`Up to ${formatGbp(deposit)}`}
              />
            </label>
            <label className="block text-sm text-neutral-800">
              What was damaged or missing?
              <textarea
                value={note}
                maxLength={DEPOSIT_NOTE_MAX_CHARS}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1 block min-h-[88px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            {formError ? <p className="text-xs text-amber-800">{formError}</p> : null}
            <Button variant="primary" size="md" loading={submitting} onClick={() => void submitClaim()}>
              Send damage report
            </Button>
          </div>
        </NoticeCard>
      ) : null}
    </>
  );
}
