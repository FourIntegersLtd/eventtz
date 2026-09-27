"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingState } from "@/foundation/ui";
import { platformErrorDetail } from "@/foundation/platform-client";
import { fetchDispute, type DisputePublic } from "@/domains/disputes/api";
import { DisputeStatusBadge } from "@/domains/disputes/DisputeStatusBadge";
import {
  DISPUTE_DETAIL_LOAD_ERROR,
  DISPUTE_NOT_FOUND,
  disputeDetailOpenedByLabel,
  formatDisputeDateTime,
  formatEventDate,
} from "@/domains/disputes/format";
import {
  bookingHref,
  counterpartyFieldLabel,
  counterpartyName,
  disputeMessagesHref,
  disputesListHref,
  type DisputePortalRole,
} from "@/domains/disputes/role";

/**
 * `/client/disputes/[disputeId]` and `/vendor/disputes/[disputeId]` — one
 * dispute's summary, status, timestamps, resolution, and a link back to the
 * booking. Filing and money actions are not on this page.
 */
export function DisputeDetailView({ role, disputeId }: { role: DisputePortalRole; disputeId: string }) {
  const [result, setResult] = useState<{
    role: DisputePortalRole;
    disputeId: string;
    dispute: DisputePublic | null;
    error: string | null;
  } | null>(null);
  // Loading follows whether the stored dispute answers this id, so the effect
  // never calls setState itself — only the fetch's then/catch do.
  const loading = result === null || result.role !== role || result.disputeId !== disputeId;
  const dispute = loading ? null : result.dispute;
  const error = loading ? null : result.error;

  useEffect(() => {
    let cancelled = false;
    fetchDispute(role, disputeId)
      .then((loaded) => {
        if (!cancelled) setResult({ role, disputeId, dispute: loaded, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({
            role,
            disputeId,
            dispute: null,
            error: platformErrorDetail(cause) ?? DISPUTE_DETAIL_LOAD_ERROR,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role, disputeId]);

  return (
    <div className="space-y-4">
      <Link
        href={disputesListHref(role)}
        className="inline-block text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        ← Back to disputes
      </Link>

      {loading ? <LoadingState variant="inline" label="Loading dispute…" /> : null}

      {!loading && (error || !dispute) ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
          {error ?? DISPUTE_NOT_FOUND}
        </p>
      ) : null}

      {!loading && dispute ? <DisputeDetailBody role={role} dispute={dispute} /> : null}
    </div>
  );
}

/** The loaded dispute: status, who opened it, the report, any outcome, and the booking link. */
function DisputeDetailBody({ role, dispute }: { role: DisputePortalRole; dispute: DisputePublic }) {
  const messagesHref = disputeMessagesHref(role, dispute.conversation_id);
  return (
    <div className="overflow-hidden rounded-2xl bg-white text-sm shadow-lg shadow-primary/5 ring-1 ring-primary-border">
      <div className="px-5 py-4">
        <DisputeStatusBadge status={dispute.status} />
        <p className="mt-3 text-sm text-neutral-700">
          Opened by <span className="font-medium text-neutral-900">{disputeDetailOpenedByLabel(dispute)}</span>
          {dispute.created_at ? (
            <span className="text-neutral-500"> · {formatDisputeDateTime(dispute.created_at)}</span>
          ) : null}
        </p>
      </div>

      <dl className="divide-y divide-neutral-100 border-t border-neutral-100">
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="px-5 py-4 sm:border-r sm:border-neutral-100">
            <dt className="text-[13px] text-neutral-500">Event</dt>
            <dd className="mt-0.5 text-sm font-medium text-neutral-900">{dispute.event_name ?? "-"}</dd>
            {dispute.event_date ? (
              <p className="mt-0.5 text-xs text-neutral-500">{formatEventDate(dispute.event_date)}</p>
            ) : null}
          </div>
          <div className="border-t border-neutral-100 px-5 py-4 sm:border-t-0">
            <dt className="text-[13px] text-neutral-500">{counterpartyFieldLabel(role)}</dt>
            <dd className="mt-0.5 text-sm font-medium text-neutral-900">{counterpartyName(role, dispute)}</dd>
          </div>
        </div>

        <div className="px-5 py-4">
          <dt className="text-[13px] text-neutral-500">What was reported</dt>
          <dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">{dispute.summary}</dd>
        </div>

        {dispute.resolution_note ? (
          <div className="bg-neutral-50 px-5 py-4">
            <dt className="text-[13px] text-neutral-500">Update from Eventtz</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
              {dispute.resolution_note}
            </dd>
            {dispute.resolved_at ? (
              <p className="mt-2 text-[13px] text-neutral-400">{formatDisputeDateTime(dispute.resolved_at)}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 bg-primary/[0.04] px-5 py-4">
          <Link
            href={bookingHref(role, dispute.booking_request_id)}
            className="inline-flex items-center justify-center rounded-xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-muted"
          >
            Open booking
          </Link>
          {messagesHref ? (
            <Link
              href={messagesHref}
              className="inline-flex items-center justify-center rounded-xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-muted"
            >
              Open messages
            </Link>
          ) : null}
        </div>
      </dl>
    </div>
  );
}
