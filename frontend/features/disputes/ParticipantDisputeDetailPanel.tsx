"use client";

import Link from "next/link";
import type { ParticipantDispute } from "@/lib/bookingDisputesApi";
import { LoadingState } from "@/components/ui/LoadingState";
import { ParticipantDisputeStatusBadge } from "@/components/ui/ParticipantDisputeStatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime, formatEventDate } from "@/lib/dateFormat";

type Props = {
  role: "client" | "vendor";
  dispute: ParticipantDispute | null;
  loading: boolean;
  error: string | null;
};

function openedByCalloutClass(dispute: ParticipantDispute): string {
  if (dispute.opened_by_you) return "border-primary/20 bg-primary/5";
  if (dispute.opened_by_role === "client") return "border-sky-200 bg-sky-50";
  if (dispute.opened_by_role === "vendor") return "border-violet-200 bg-violet-50";
  return "border-neutral-200 bg-neutral-50";
}

function openedByTitle(dispute: ParticipantDispute): string {
  if (dispute.opened_by_you) return "You opened this dispute";
  if (dispute.opened_by_role === "client") return "The client opened this dispute";
  if (dispute.opened_by_role === "vendor") return "The vendor opened this dispute";
  return "Opened on this booking";
}

export function ParticipantDisputeDetailPanel({ role, dispute, loading, error }: Props) {
  const bookingsBase = role === "client" ? "/client/bookings" : "/vendor/bookings";
  const messagesBase = role === "client" ? "/client/messages" : "/vendor/messages";

  if (loading) {
    return <LoadingState label="Loading dispute…" variant="inline" />;
  }

  if (error || !dispute) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error ?? "Dispute not found."}
      </p>
    );
  }

  const bookingHref = `${bookingsBase}/${encodeURIComponent(dispute.booking_request_id)}`;
  const messagesHref = dispute.conversation_id
    ? `${messagesBase}/${encodeURIComponent(dispute.conversation_id)}`
    : null;

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ParticipantDisputeStatusBadge status={dispute.status} />
        {dispute.payment_status ? (
          <PaymentStatusBadge status={dispute.payment_status} />
        ) : null}
      </div>

      <div className={`rounded-xl border px-4 py-3 ${openedByCalloutClass(dispute)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Who opened this</p>
        <p className="mt-1 text-sm font-semibold text-neutral-900">{openedByTitle(dispute)}</p>
        {dispute.opened_by_display_name && !dispute.opened_by_you ? (
          <p className="mt-0.5 text-sm text-neutral-800">{dispute.opened_by_display_name}</p>
        ) : null}
      </div>

      <section className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Booking parties</h3>
        <div className="space-y-1.5 text-xs">
          <div className={dispute.opened_by_role === "client" ? "font-medium text-neutral-900" : "text-neutral-700"}>
            <span className="text-neutral-500">Client: </span>
            <span>{dispute.client_label ?? "—"}</span>
            {dispute.opened_by_role === "client" ? (
              <span className="ml-1.5 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                Opened dispute
              </span>
            ) : null}
          </div>
          <div className={dispute.opened_by_role === "vendor" ? "font-medium text-neutral-900" : "text-neutral-700"}>
            <span className="text-neutral-500">Vendor: </span>
            <span>{dispute.vendor_display_name ?? "—"}</span>
            {dispute.opened_by_role === "vendor" ? (
              <span className="ml-1.5 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                Opened dispute
              </span>
            ) : null}
          </div>
        </div>
        <dl className="space-y-2 border-t border-neutral-100 pt-3">
          <div>
            <dt className="text-xs text-neutral-500">Event</dt>
            <dd className="mt-0.5 font-medium text-neutral-900">
              {dispute.event_name ?? "—"}
              {dispute.event_date ? (
                <span className="font-normal text-neutral-600"> · {formatEventDate(dispute.event_date)}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Booking status</dt>
            <dd className="mt-0.5">
              {dispute.booking_status ? (
                <StatusBadge status={dispute.booking_status} />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href={bookingHref} className="text-sm font-medium text-primary hover:underline">
              Open booking
            </Link>
            {messagesHref ? (
              <Link href={messagesHref} className="text-sm font-medium text-primary hover:underline">
                Open messages
              </Link>
            ) : null}
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-medium text-neutral-800">What was reported</h3>
        <p className="mt-2 whitespace-pre-wrap rounded-xl border border-neutral-100 bg-white p-3 text-neutral-900">
          {dispute.summary}
        </p>
        {dispute.chat_included_for_review ? (
          <p className="mt-2 text-xs text-neutral-500">
            Your booking messages were included for review.
          </p>
        ) : null}
      </section>

      {dispute.resolution_note ? (
        <section>
          <h3 className="text-sm font-medium text-neutral-800">Update from Eventtz</h3>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-neutral-100 bg-white p-3 text-neutral-900">
            {dispute.resolution_note}
          </p>
        </section>
      ) : null}

      <dl className="grid gap-2 rounded-xl border border-neutral-100 bg-neutral-50/30 p-3 text-xs text-neutral-500 sm:grid-cols-3">
        <div>
          <dt>Created</dt>
          <dd className="mt-0.5 text-neutral-700">
            {dispute.created_at ? formatDateTime(dispute.created_at) : "—"}
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd className="mt-0.5 text-neutral-700">
            {dispute.updated_at ? formatDateTime(dispute.updated_at) : "—"}
          </dd>
        </div>
        <div>
          <dt>Resolved</dt>
          <dd className="mt-0.5 text-neutral-700">
            {dispute.resolved_at ? formatDateTime(dispute.resolved_at) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
