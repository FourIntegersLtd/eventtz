"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchClientBookingDisputes,
  fetchVendorBookingDisputes,
  postClientBookingDispute,
  postVendorBookingDispute,
  type ParticipantDispute,
} from "@/lib/bookingDisputesApi";
import {
  canOpenDisputeForBookingStatus,
  participantDisputeStatusLabel,
} from "@/lib/bookingDisputeHelpers";

const POLL_MS = 50_000;

type Props = {
  bookingId: string;
  role: "client" | "vendor";
  /** Current booking row status — gates “open new dispute” to match backend rules. */
  bookingStatus: string;
  /** Inline card (default) or compact row + slide-over drawer (booking detail panels). */
  presentation?: "inline" | "drawer";
};

export function BookingDisputeSection({
  bookingId,
  role,
  bookingStatus,
  presentation = "inline",
}: Props) {
  const [disputes, setDisputes] = useState<ParticipantDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows =
        role === "client"
          ? await fetchClientBookingDisputes(bookingId)
          : await fetchVendorBookingDisputes(bookingId);
      setDisputes(rows);
    } catch {
      setError("Could not load dispute status.");
    } finally {
      setLoading(false);
    }
  }, [bookingId, role]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [bookingId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const hasActive = disputes.some((d) => d.status === "open" || d.status === "under_review");
  const statusAllowsNewDispute = canOpenDisputeForBookingStatus(bookingStatus);
  /** Match backend: one active case per booking; status must be pending/accepted/completed for new cases. */
  const canOpenNew = statusAllowsNewDispute && !hasActive;

  const body = (
    <>
      {loading ? (
        <p className="mt-3 text-xs text-neutral-500">Loading…</p>
      ) : (
        <>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          ) : null}

          {disputes.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {disputes.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">
                      {participantDisputeStatusLabel(d.status)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {d.created_at ? new Date(d.created_at).toLocaleString("en-GB") : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-700 line-clamp-3">{d.summary}</p>
                  {d.resolution_note ? (
                    <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
                      <span className="font-semibold text-neutral-800">
                        {d.status === "resolved" || d.status === "closed" ? "Outcome: " : "Update: "}
                      </span>
                      {d.resolution_note}
                    </p>
                  ) : null}
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
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Describe what happened…"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <button
                type="button"
                disabled={busy || summary.trim().length < 10}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const created =
                      role === "client"
                        ? await postClientBookingDispute(bookingId, summary.trim())
                        : await postVendorBookingDispute(bookingId, summary.trim());
                    setDisputes((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
                    setSummary("");
                    await load();
                  } catch (e: unknown) {
                    setError(getApiErrorDetail(e) ?? "Could not submit dispute.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Open a dispute"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );

  if (presentation === "drawer") {
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white px-3 py-3 text-left shadow-sm transition hover:border-amber-300 hover:from-amber-50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-neutral-900">
                Help &amp; disputes
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                {loading
                  ? "Loading…"
                  : hasActive
                    ? "A case is open — tap for status"
                    : disputes.length > 0
                      ? "View past cases"
                      : "Report an issue with this booking"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!loading && disputes.length > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                {disputes.length} {disputes.length === 1 ? "case" : "cases"}
              </span>
            ) : null}
            <ChevronRight className="h-5 w-5 text-neutral-400" aria-hidden />
          </div>
        </button>
        <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Help & disputes">
          <div className="mt-3">{body}</div>
        </Drawer>
      </>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-sm font-semibold text-neutral-900">Help & disputes</h3>
        </div>
      </div>
      {body}
    </section>
  );
}
