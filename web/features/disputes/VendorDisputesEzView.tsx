"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import {
  fetchParticipantDisputesPage,
  fetchVendorDispute,
  PARTICIPANT_DISPUTES_PAGE_SIZE,
  type ParticipantDispute,
} from "@/lib/bookingDisputesApi";
import { TablePagination } from "@/components/ui/TablePagination";
import { participantDisputeBookingLabel, participantDisputeStatusLabel } from "@/lib/bookingDisputeHelpers";
import { formatDate } from "@/lib/dateFormat";
import { Badge } from "@/components/ui/Badge";
import type { Tone } from "@/lib/tone";

/** Badge tone for a dispute status. */
function disputeTone(status: string): Tone {
  if (status === "open") return "danger";
  if (status === "under_review") return "warning";
  if (status === "resolved") return "success";
  return "neutral";
}

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(date, "dayMonthYear");
}

type VendorDisputesEzViewProps = {
  selectedDisputeId?: string | null;
};

/** Vendor disputes (design V26). Reply stays in messages; there is no separate dispute-reply API. */
export function VendorDisputesEzView({ selectedDisputeId = null }: VendorDisputesEzViewProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ParticipantDispute[] | null>(null);
  const [selected, setSelected] = useState<ParticipantDispute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchParticipantDisputesPage("vendor", offset, PARTICIPANT_DISPUTES_PAGE_SIZE)
      .then((page) => {
        if (!cancelled) {
          setRows(page.disputes);
          setTotal(page.total);
          setOpenCount(page.open_count ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load disputes.");
      });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  useEffect(() => {
    if (!selectedDisputeId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    void fetchVendorDispute(selectedDisputeId)
      .then((row) => {
        if (!cancelled) setSelected(row);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this dispute.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDisputeId]);

  const active = selected ?? (rows ?? []).find((row) => row.status === "open") ?? null;

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader descriptionSize="body"
        eyebrow="Work"
        title="Disputes"
        description="Raise or answer a problem. Payouts are paused while a dispute is open."
      />

      {openCount > 0 ? (
        <div className="ez-banner ez-banner--danger">
          <Shield size={20} strokeWidth={1.75} aria-hidden />
          <div className="ez-banner__body">
            <div className="ez-banner__title">
              {openCount} dispute{openCount === 1 ? "" : "s"} need{openCount === 1 ? "s" : ""} your response
            </div>
            <p className="ez-small" style={{ color: "inherit" }}>
              Reply in messages. Eventtz decides with the evidence both sides share.
            </p>
          </div>
        </div>
      ) : null}

      {error ? <LottieFailureInline message={error} /> : null}

      {rows === null ? (
        <LoadingState label="Loading disputes…" variant="inline" />
      ) : rows.length === 0 ? (
        <EmptyState
          className="border-0"
          lottie="allCaughtUp"
          title="No disputes"
          description="If a client raises a problem, it will show here."
        />
      ) : (
        <div className="ez-table-wrap">
          <table className="ez-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Booking</th>
                <th className="ez-td-status">Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/vendor/disputes/${row.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="ez-td-strong">{row.id.slice(0, 8).toUpperCase()}</td>
                  <td>{participantDisputeBookingLabel(row)}</td>
                  <td className="ez-td-status">
                    <Badge tone={disputeTone(row.status)}>{participantDisputeStatusLabel(row.status)}</Badge>
                  </td>
                  <td>{row.status === "resolved" ? `Resolved ${whenLabel(row.resolved_at)}` : `Opened ${whenLabel(row.created_at)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows !== null && total > 0 ? (
        <TablePagination
          offset={offset}
          limit={PARTICIPANT_DISPUTES_PAGE_SIZE}
          total={total}
          loading={rows === null}
          onPrevious={() =>
            setOffset((current) => Math.max(0, current - PARTICIPANT_DISPUTES_PAGE_SIZE))
          }
          onNext={() => setOffset((current) => current + PARTICIPANT_DISPUTES_PAGE_SIZE)}
        />
      ) : null}

      {active ? (
        <div className="ez-split">
          <div className="ez-split__main">
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">
                  {active.counterparty_label || active.client_label || "Dispute"} · {participantDisputeBookingLabel(active)}
                </span>
                <Badge tone={disputeTone(active.status)}>{participantDisputeStatusLabel(active.status)}</Badge>
              </div>
              <div className="ez-card__body">
                <div className="ez-stack ez-stack--sm">
                  <span className="ez-label">{active.opened_by_you ? "You said" : "Client says"}</span>
                  <p className="ez-body">{active.summary}</p>
                  {active.resolution_note ? (
                    <>
                      <span className="ez-label">Decision</span>
                      <p className="ez-body">{active.resolution_note}</p>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="ez-card__foot">
                {active.conversation_id ? (
                  <Link className="ez-btn ez-btn--primary" href={`/vendor/messages/${active.conversation_id}`}>
                    <SendIcon />
                    Reply in messages
                  </Link>
                ) : (
                  <Link className="ez-btn ez-btn--secondary" href={`/vendor/bookings/${active.booking_request_id}`}>
                    Open booking
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="ez-split__aside">
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">What happens</span>
              </div>
              <div className="ez-card__body">
                <div className="ez-timeline">
                  <div className="ez-tl-item ez-tl-item--done">
                    <span className="ez-tl-dot" />
                    <div className="ez-tl-body">
                      <span className="ez-tl-title">Dispute opened</span>
                      <span className="ez-small">{whenLabel(active.created_at)}</span>
                    </div>
                  </div>
                  <div className={`ez-tl-item${active.status === "open" ? " ez-tl-item--current" : " ez-tl-item--done"}`}>
                    <span className="ez-tl-dot" />
                    <div className="ez-tl-body">
                      <span className="ez-tl-title">Both sides respond</span>
                      <span className="ez-small">In messages, with any evidence</span>
                    </div>
                  </div>
                  <div className={`ez-tl-item${active.status === "resolved" || active.status === "closed" ? " ez-tl-item--done" : " ez-tl-item--todo"}`}>
                    <span className="ez-tl-dot" />
                    <div className="ez-tl-body">
                      <span className="ez-tl-title">Eventtz reviews and decides</span>
                      <span className="ez-small">Both of you are emailed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  );
}
