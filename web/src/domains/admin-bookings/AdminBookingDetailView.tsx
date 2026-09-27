"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateCancelOnBehalfReason } from "@/domains/admin-bookings/cancelOnBehalfValidation";
import { Button } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import {
  AdminErrorBanner,
  AdminLoadingState,
  AdminSuccessBanner,
  formatDateTime,
  formatGbp,
  humanize,
  adminCapabilities,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import {
  adminCancelBookingOnBehalf,
  adminCompleteBookingCancellation,
  adminConfirmBookingCompletion,
  adminReleaseBookingPayout,
  adminResetBookingCheckout,
  adminRetryBookingPayout,
  adminRunBookingMaintenance,
  adminSetBookingSupportHold,
  adminSyncBookingPayment,
  fetchAdminBookingDetail,
  type AdminBookingDetail,
} from "@/domains/admin-bookings/api";

/**
 * `/admin/bookings/[id]` — the admin-eyes view of one booking, with the
 * money-moving support actions gated to super admins only, matching
 * `frontend/features/admin/bookings/AdminBookingDetailView.tsx`.
 *
 * Now wires the full recovery-tool set the payments workstream (ws1) shipped:
 * reset-checkout, support-hold, sync-payment, release/retry payout,
 * complete-cancellation, confirm-completion, cancel-on-behalf and
 * run-maintenance. Every action re-renders from the fresh
 * `AdminBookingDetail` the endpoint returns and is recorded in the audit log
 * server-side.
 */
export function AdminBookingDetailView({ bookingId }: { bookingId: string }) {
  const { session } = useSession();
  const canActOnMoney = adminCapabilities.canRunBookingSupportActions(session);

  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCancelOnBehalf, setShowCancelOnBehalf] = useState(false);
  const [cancelParty, setCancelParty] = useState<"client" | "vendor">("client");
  const [cancelReason, setCancelReason] = useState("");
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const detail = await fetchAdminBookingDetail(bookingId);
      if (mySeq !== requestSeq.current) return;
      setBooking(detail);
    } catch (cause) {
      if (mySeq !== requestSeq.current) return;
      setError(isPlatformError(cause) ? cause.detail : "Not found.");
    } finally {
      if (mySeq !== requestSeq.current) return;
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleUnblockCheckout() {
    if (!window.confirm("Clear this booking's checkout session so the client can try paying again?")) return;
    setActionBusy("reset");
    setNotice(null);
    try {
      setBooking(await adminResetBookingCheckout(bookingId));
      setNotice("Checkout cleared. The client can try paying again.");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "That didn't work. Try again.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleHoldToggle() {
    if (!booking) return;
    const nextHold = !booking.support.support_hold;
    setActionBusy("hold");
    setNotice(null);
    try {
      setBooking(await adminSetBookingSupportHold(bookingId, nextHold));
      setNotice(nextHold ? "Payout paused for this booking." : "Payout resumed for this booking.");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "That didn't work. Try again.");
    } finally {
      setActionBusy(null);
    }
  }

  /**
   * Runs one of the no-argument recovery tools (sync payment, release/retry
   * payout, complete cancellation, confirm completion, run maintenance).
   * Shared because they all follow the same shape: confirm, call, refresh.
   */
  async function runRecoveryAction(
    key: string,
    confirmMessage: string,
    action: (id: string) => Promise<AdminBookingDetail>,
    successMessage: string,
  ) {
    if (!window.confirm(confirmMessage)) return;
    setActionBusy(key);
    setNotice(null);
    try {
      setBooking(await action(bookingId));
      setNotice(successMessage);
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "That didn't work. Try again.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCancelOnBehalf() {
    const validationError = validateCancelOnBehalfReason(cancelReason);
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionBusy("cancel");
    setNotice(null);
    try {
      setBooking(await adminCancelBookingOnBehalf(bookingId, { party: cancelParty, reason: cancelReason.trim() }));
      setNotice("Booking cancelled on the party's behalf.");
      setShowCancelOnBehalf(false);
      setCancelReason("");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "That didn't work. Try again.");
    } finally {
      setActionBusy(null);
    }
  }

  if (loading) return <AdminLoadingState label="Loading booking…" />;
  if (error || !booking) return <AdminErrorBanner message={error ?? "Not found."} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary-border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">{booking.event_name}</h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 font-medium text-primary">
                {humanize(booking.status)}
              </span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
                {humanize(booking.payment_status)}
              </span>
            </div>
          </div>
          {booking.support.needs_attention?.length ? (
            <div className="mt-3 space-y-1">
              {booking.support.needs_attention.map((flag) => (
                <p
                  key={flag.code}
                  className={
                    flag.severity === "critical"
                      ? "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                      : "rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700"
                  }
                >
                  {flag.label}
                </p>
              ))}
            </div>
          ) : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-neutral-500">Event date</dt>
            <dd className="text-neutral-900">{formatDateTime(booking.event_date)}</dd>
            <dt className="text-neutral-500">Postcode</dt>
            <dd className="text-neutral-900">{booking.event_postcode ?? "-"}</dd>
            <dt className="text-neutral-500">Client</dt>
            <dd className="text-neutral-900">{booking.client_email ?? "-"}</dd>
            <dt className="text-neutral-500">Vendor</dt>
            <dd className="text-neutral-900">
              {booking.vendor_display_name} ({booking.vendor_email ?? "-"})
            </dd>
            <dt className="text-neutral-500">Payment amount</dt>
            <dd className="text-neutral-900">{formatGbp(booking.payment_amount_gbp)}</dd>
            <dt className="text-neutral-500">Paid at</dt>
            <dd className="text-neutral-900">{formatDateTime(booking.paid_at)}</dd>
            <dt className="text-neutral-500">Payout sent</dt>
            <dd className="text-neutral-900">{formatDateTime(booking.payout_released_at)}</dd>
          </dl>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Payment refs</summary>
            <dl className="mt-2 space-y-1 text-xs text-neutral-600">
              <div>Payment intent: {booking.stripe_payment_intent_id ?? "-"}</div>
              <div>Charge: {booking.stripe_charge_id ?? "-"}</div>
              <div>Checkout session: {booking.stripe_checkout_session_id ?? "-"}</div>
              <div>Transfer: {booking.stripe_transfer_id ?? "-"}</div>
            </dl>
          </details>
        </div>
      </div>

      <aside className="space-y-3 rounded-2xl border border-primary-border bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Support actions</h3>
        {notice ? <AdminSuccessBanner message={notice} /> : null}
        {canActOnMoney ? (
          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "reset"}
              onClick={() => void handleUnblockCheckout()}
            >
              Unblock checkout
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "hold"}
              onClick={() => void handleHoldToggle()}
            >
              {booking.support.support_hold ? "Resume payout" : "Pause payout"}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "sync"}
              onClick={() =>
                void runRecoveryAction(
                  "sync",
                  "Ask Stripe whether the client paid and mark this booking paid if they did?",
                  adminSyncBookingPayment,
                  "Payment status synced with Stripe.",
                )
              }
            >
              Sync payment with Stripe
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "release"}
              onClick={() =>
                void runRecoveryAction(
                  "release",
                  "Release the vendor payout for this booking now?",
                  adminReleaseBookingPayout,
                  "Payout released.",
                )
              }
            >
              Release payout
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "retry"}
              onClick={() =>
                void runRecoveryAction(
                  "retry",
                  "Retry the vendor payout for this booking?",
                  adminRetryBookingPayout,
                  "Payout retried.",
                )
              }
            >
              Retry payout
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "confirm-completion"}
              onClick={() =>
                void runRecoveryAction(
                  "confirm-completion",
                  "Confirm the event went ahead on this party's behalf?",
                  adminConfirmBookingCompletion,
                  "Completion confirmed.",
                )
              }
            >
              Confirm completion
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "complete-cancellation"}
              onClick={() =>
                void runRecoveryAction(
                  "complete-cancellation",
                  "Mark this refunded booking cancelled?",
                  adminCompleteBookingCancellation,
                  "Cancellation completed.",
                )
              }
            >
              Complete cancellation
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "maintenance"}
              onClick={() =>
                void runRecoveryAction(
                  "maintenance",
                  "Run the post-event maintenance step now (reminder, then any due payout)?",
                  adminRunBookingMaintenance,
                  "Maintenance step run.",
                )
              }
            >
              Run maintenance now
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionBusy === "cancel"}
              onClick={() => setShowCancelOnBehalf(true)}
            >
              Cancel on behalf of a party
            </Button>
            {showCancelOnBehalf ? (
              <div className="space-y-2 rounded-xl border border-primary-border bg-primary-soft/40 p-3">
                <label className="block text-xs font-medium text-neutral-700">
                  Who asked support to cancel?
                  <select
                    value={cancelParty}
                    onChange={(event) => setCancelParty(event.target.value as "client" | "vendor")}
                    className="mt-1 w-full rounded-lg border border-primary-border px-2 py-1.5 text-sm"
                  >
                    <option value="client">Client</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-neutral-700">
                  Reason
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-primary-border px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={!cancelReason.trim()}
                    loading={actionBusy === "cancel"}
                    onClick={() => void handleCancelOnBehalf()}
                  >
                    Confirm cancellation
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setShowCancelOnBehalf(false)}>
                    Back
                  </Button>
                </div>
              </div>
            ) : null}
            <p className="text-xs text-neutral-500">Recorded in the admin audit log.</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-600">
            You can review this booking and escalate if needed. Payment and refund actions are limited to super
            admins.
          </p>
        )}
      </aside>
    </div>
  );
}
