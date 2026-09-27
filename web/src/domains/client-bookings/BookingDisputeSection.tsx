"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog, LoadingState } from "@/foundation/ui";
import { hasCode, platformErrorDetail } from "@/foundation/platform-client";
import {
  fetchClientBookingDisputes,
  postClientBookingDispute,
  type ClientBookingDispute,
} from "@/domains/client-bookings/api";
import {
  canOfferOpenDispute,
  DISPUTE_POLL_MS,
  disputeOpenedAtLabel,
  disputeResolutionPrefix,
  disputeStatusBadgeClass,
  disputeStatusLabel,
} from "@/domains/client-bookings/disputeRules";
import {
  DISPUTE_ALREADY_OPEN_FALLBACK,
  DISPUTE_LOAD_FAILED,
  DISPUTE_OPENED_MESSAGE,
  DISPUTE_SUBMIT_FAILED,
  OPEN_DISPUTE_CONFIRM,
  parseDisputeSummary,
} from "@/domains/client-bookings/disputeSummary";

/**
 * The "Help & disputes" block on a client booking. The baseline puts this
 * in the booking header (a Help control that opens a drawer). Drawer, toast
 * and Lottie are not part of this frontend, so the same list, form and
 * confirm step render inline in that header.
 *
 * A new dispute is offered only when `canOfferOpenDispute` is true. The
 * list re-reads every {@link DISPUTE_POLL_MS} and when the tab becomes
 * visible again; both timers are cleared on unmount.
 */
export function BookingDisputeSection({
  bookingId,
  bookingStatus,
}: {
  bookingId: string;
  bookingStatus: string;
}) {
  const [result, setResult] = useState<{
    bookingId: string;
    disputes: ClientBookingDispute[];
    error: string | null;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ bookingId: string; message: string } | null>(null);
  const submittingRef = useRef(false);

  // Loading follows whether the stored rows answer this booking, so the
  // effect never calls setState itself — only the fetch's then/catch do.
  const loading = result === null || result.bookingId !== bookingId;
  const disputes = loading ? [] : result.disputes;
  const loadError = loading ? null : result.error;
  const errorMessage = formError ?? loadError;
  const successMessage = notice?.bookingId === bookingId ? notice.message : null;
  const canOpenNew = canOfferOpenDispute(
    bookingStatus,
    disputes.map((dispute) => dispute.status),
  );

  useEffect(() => {
    let cancelled = false;
    function loadDisputes() {
      fetchClientBookingDisputes(bookingId)
        .then((rows) => {
          if (!cancelled) setResult({ bookingId, disputes: rows, error: null });
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setResult((current) => ({
              bookingId,
              disputes: current?.bookingId === bookingId ? current.disputes : [],
              error: platformErrorDetail(cause) ?? DISPUTE_LOAD_FAILED,
            }));
          }
        });
    }
    loadDisputes();
    const intervalId = window.setInterval(loadDisputes, DISPUTE_POLL_MS);
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") loadDisputes();
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [bookingId, reloadToken]);

  function requestConfirm() {
    const parsed = parseDisputeSummary({ summary });
    if (!parsed.ok) {
      setFormError(parsed.formError);
      return;
    }
    setFormError(null);
    setConfirmOpen(true);
  }

  async function submitDispute() {
    if (submittingRef.current) return;
    const parsed = parseDisputeSummary({ summary });
    if (!parsed.ok) {
      setFormError(parsed.formError);
      setConfirmOpen(false);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await postClientBookingDispute(bookingId, parsed.data.summary);
      setSummary("");
      setNotice({ bookingId, message: DISPUTE_OPENED_MESSAGE });
      setConfirmOpen(false);
      setResult((current) => ({
        bookingId,
        disputes: [
          created,
          ...(current?.bookingId === bookingId ? current.disputes : []).filter((row) => row.id !== created.id),
        ],
        error: null,
      }));
      try {
        const rows = await fetchClientBookingDisputes(bookingId);
        setResult({ bookingId, disputes: rows, error: null });
      } catch {
        // The dispute just filed is already in the list; the poll will refresh it.
      }
    } catch (cause: unknown) {
      const alreadyOpen = hasCode(cause, "dispute_already_open");
      setFormError(
        alreadyOpen
          ? (platformErrorDetail(cause) ?? DISPUTE_ALREADY_OPEN_FALLBACK)
          : (platformErrorDetail(cause) ?? DISPUTE_SUBMIT_FAILED),
      );
      setConfirmOpen(false);
      if (alreadyOpen) setReloadToken((token) => token + 1);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white px-5 py-4">
      <ConfirmDialog
        isOpen={confirmOpen}
        title={OPEN_DISPUTE_CONFIRM.title}
        description={OPEN_DISPUTE_CONFIRM.description}
        cancelLabel={OPEN_DISPUTE_CONFIRM.cancelLabel}
        confirmLabel={OPEN_DISPUTE_CONFIRM.confirmLabel}
        confirmLoadingLabel={OPEN_DISPUTE_CONFIRM.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={submitting}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={() => void submitDispute()}
      />
      <h3 className="text-sm font-semibold text-neutral-900">Help &amp; disputes</h3>

      {loading ? (
        <div className="mt-3">
          <LoadingState variant="inline" label="Loading…" />
        </div>
      ) : (
        <>
          {errorMessage ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200/60">
              {successMessage}
            </p>
          ) : null}

          {disputes.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {disputes.map((dispute) => (
                <li key={dispute.id} className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${disputeStatusBadgeClass(dispute.status)}`}
                    >
                      {disputeStatusLabel(dispute.status)}
                    </span>
                    <span className="text-xs text-neutral-500">{disputeOpenedAtLabel(dispute.created_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-xs text-neutral-700">{dispute.summary}</p>
                  {dispute.resolution_note ? (
                    <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
                      <span className="font-semibold text-neutral-800">{disputeResolutionPrefix(dispute.status)}</span>
                      {dispute.resolution_note}
                    </p>
                  ) : null}
                  <Link
                    href={`/client/disputes/${encodeURIComponent(dispute.id)}`}
                    className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline"
                  >
                    View dispute details
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {canOpenNew ? (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="sr-only">Describe the issue</span>
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  disabled={submitting}
                  placeholder="Describe what happened…"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 md:text-sm"
                />
              </label>
              <button
                type="button"
                disabled={submitting || !summary.trim()}
                onClick={requestConfirm}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Open a dispute"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
