"use client";

import type { ParticipantDispute } from "@/lib/bookingDisputesApi";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LoadingState } from "@/components/ui/LoadingState";
import { ParticipantDisputeStatusBadge } from "@/components/ui/ParticipantDisputeStatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { formatDateTime, formatEventDate } from "@/lib/dateFormat";

type Props = {
  role: "client" | "vendor";
  dispute: ParticipantDispute | null;
  loading: boolean;
  error: string | null;
};

function openedByLabel(dispute: ParticipantDispute): string {
  if (dispute.opened_by_you) return "You";
  if (dispute.opened_by_display_name?.trim()) return dispute.opened_by_display_name.trim();
  if (dispute.opened_by_role === "client") return "The client";
  if (dispute.opened_by_role === "vendor") return "The vendor";
  return "Someone on this booking";
}

export function ParticipantDisputeDetailPanel({ role, dispute, loading, error }: Props) {
  const bookingsBase = role === "client" ? "/client/bookings" : "/vendor/bookings";
  const messagesBase = role === "client" ? "/client/messages" : "/vendor/messages";

  if (loading) {
    return <LoadingState label="Loading dispute…" variant="inline" />;
  }

  if (error || !dispute) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error ?? "Dispute not found."}
      </p>
    );
  }

  const bookingHref = `${bookingsBase}/${encodeURIComponent(dispute.booking_request_id)}`;
  const messagesHref = dispute.conversation_id
    ? `${messagesBase}/${encodeURIComponent(dispute.conversation_id)}`
    : null;
  const counterparty =
    role === "client"
      ? dispute.vendor_display_name
      : dispute.client_label;

  return (
    <div className="space-y-6 text-sm">
      <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <ParticipantDisputeStatusBadge status={dispute.status} />
            {dispute.payment_status ? (
              <PaymentStatusBadge status={dispute.payment_status} />
            ) : null}
          </div>
          <p className="mt-3 text-sm text-neutral-700">
            Opened by <span className="font-medium text-neutral-900">{openedByLabel(dispute)}</span>
            {dispute.created_at ? (
              <span className="text-neutral-500"> · {formatDateTime(dispute.created_at)}</span>
            ) : null}
          </p>
        </div>

        <dl className="divide-y divide-neutral-100 border-t border-neutral-100">
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="px-5 py-4 sm:border-r sm:border-neutral-100">
              <dt className="text-[13px] text-neutral-500">Event</dt>
              <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                {dispute.event_name ?? "—"}
              </dd>
              {dispute.event_date ? (
                <p className="mt-0.5 text-xs text-neutral-500">
                  {formatEventDate(dispute.event_date)}
                </p>
              ) : null}
            </div>
            <div className="border-t border-neutral-100 px-5 py-4 sm:border-t-0">
              <dt className="text-[13px] text-neutral-500">
                {role === "client" ? "Vendor" : "Client"}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                {counterparty ?? "—"}
              </dd>
            </div>
          </div>

          <div className="px-5 py-4">
            <dt className="text-[13px] text-neutral-500">What was reported</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
              {dispute.summary}
            </dd>
            {dispute.chat_included_for_review ? (
              <p className="mt-2 text-[13px] text-neutral-400">
                Booking messages were included for review
              </p>
            ) : null}
          </div>

          {dispute.resolution_note ? (
            <div className="bg-neutral-50 px-5 py-4">
              <dt className="text-[13px] text-neutral-500">Update from Eventtz</dt>
              <dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
                {dispute.resolution_note}
              </dd>
              {dispute.resolved_at ? (
                <p className="mt-2 text-[13px] text-neutral-400">
                  {formatDateTime(dispute.resolved_at)}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 bg-primary/[0.04] px-5 py-4">
            <ButtonLink href={bookingHref} variant="secondary" size="sm">
              Open booking
            </ButtonLink>
            {messagesHref ? (
              <ButtonLink href={messagesHref} variant="secondary" size="sm">
                Open messages
              </ButtonLink>
            ) : null}
          </div>
        </dl>
      </div>
    </div>
  );
}
