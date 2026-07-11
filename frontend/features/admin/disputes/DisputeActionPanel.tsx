"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { patchAdminDispute, type AdminDisputeCase } from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  DisputeOpenedByCallout,
  DisputePartiesSummary,
} from "./DisputePartiesSummary";
import {
  assignmentLabel,
  bookingStatusLabel,
  DISPUTE_STATUSES,
  disputeBookingLabel,
  disputeStatusBadgeClass,
  formatEventDate,
  formatWhen,
  resolutionActionLabel,
  statusLabel,
} from "./disputeFormatters";

type DisputeActionPanelProps = {
  dispute: AdminDisputeCase;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onResolve: (dispute: AdminDisputeCase) => void;
};

export function DisputeActionPanel({
  dispute,
  onClose,
  onUpdated,
  onResolve,
}: DisputeActionPanelProps) {
  const { user } = useAuth();
  const [sharedNote, setSharedNote] = useState(dispute.resolution_note ?? "");
  const [status, setStatus] = useState(dispute.status);
  const [noteBusy, setNoteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<AdminDisputeCase["status"] | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    setSharedNote(dispute.resolution_note ?? "");
    setStatus(dispute.status);
  }, [dispute.id, dispute.resolution_note, dispute.status]);

  const chatHref = dispute.conversation_id
    ? `/admin/trust?tab=chat&conversation=${encodeURIComponent(dispute.conversation_id)}`
    : null;

  const canResolve = dispute.status === "open" || dispute.status === "under_review";

  const saveSharedNote = async () => {
    setError(null);
    setNoteBusy(true);
    try {
      await patchAdminDispute(dispute.id, { resolution_note: sharedNote.trim() || null });
      await onUpdated();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not save message.");
    } finally {
      setNoteBusy(false);
    }
  };

  const applyStatus = async (next: AdminDisputeCase["status"]) => {
    setError(null);
    setStatusBusy(true);
    try {
      await patchAdminDispute(dispute.id, { status: next });
      setStatus(next);
      setPendingStatus(null);
      setConfirmClose(false);
      await onUpdated();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not update status.");
      setStatus(dispute.status);
    } finally {
      setStatusBusy(false);
    }
  };

  const assignToMe = async () => {
    if (!user?.id) return;
    setError(null);
    setAssignBusy(true);
    try {
      await patchAdminDispute(dispute.id, { assigned_admin_id: user.id });
      await onUpdated();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not assign dispute.");
    } finally {
      setAssignBusy(false);
    }
  };

  const onStatusSelect = (next: AdminDisputeCase["status"]) => {
    if (next === dispute.status) return;
    if (next === "closed") {
      setPendingStatus(next);
      setConfirmClose(true);
      return;
    }
    void applyStatus(next);
  };

  return (
    <>
      <Drawer
        isOpen={true}
        onClose={onClose}
        title="Manage dispute"
        subtitle={disputeBookingLabel(dispute)}
        widthClassName="max-w-lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canResolve ? (
              <Button onClick={() => onResolve(dispute)}>Resolve dispute</Button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-5 text-sm">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">{error}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${disputeStatusBadgeClass(dispute.status)}`}
            >
              {statusLabel(dispute.status)}
            </span>
            {dispute.resolution_action ? (
              <span className="text-xs text-neutral-500">
                {resolutionActionLabel(dispute.resolution_action)}
              </span>
            ) : null}
          </div>

          <DisputeOpenedByCallout dispute={dispute} />

          <section className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Booking parties</h3>
            <DisputePartiesSummary dispute={dispute} />
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
                <dd className="mt-0.5 capitalize text-neutral-800">
                  {bookingStatusLabel(dispute.booking_status)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">View booking</dt>
                <dd className="mt-0.5">
                  <Link
                    href={`/admin/bookings/${dispute.booking_request_id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Open booking details
                  </Link>
                </dd>
              </div>
              {chatHref ? (
                <div>
                  <dt className="text-xs text-neutral-500">Messages</dt>
                  <dd className="mt-0.5">
                    <Link href={chatHref} className="text-sm font-medium text-primary hover:underline">
                      View conversation
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-medium text-neutral-800">What they reported</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-neutral-100 bg-white p-3 text-neutral-900">
              {dispute.summary}
            </p>
          </section>

          <div>
            <label htmlFor="dispute-shared-note" className="text-sm font-medium text-neutral-800">
              Message for client and vendor
            </label>
            <textarea
              id="dispute-shared-note"
              value={sharedNote}
              onChange={(e) => setSharedNote(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              placeholder="Your message…"
            />
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              loading={noteBusy}
              onClick={() => void saveSharedNote()}
            >
              Save message
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dispute-status" className="text-sm font-medium text-neutral-800">
                Status
              </label>
              <select
                id="dispute-status"
                value={status}
                disabled={statusBusy}
                onChange={(e) => {
                  const next = e.target.value as AdminDisputeCase["status"];
                  if (next === "resolved") {
                    onResolve(dispute);
                    return;
                  }
                  setStatus(next);
                  onStatusSelect(next);
                }}
                className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm capitalize"
              >
                {DISPUTE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-800">Assignment</p>
              <p className="mt-2 text-sm text-neutral-700">
                {assignmentLabel(dispute.assigned_admin_id, user?.id)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                loading={assignBusy}
                disabled={!user?.id || dispute.assigned_admin_id === user?.id}
                onClick={() => void assignToMe()}
              >
                Assign to me
              </Button>
            </div>
          </div>

          <dl className="grid gap-2 rounded-xl border border-neutral-100 bg-neutral-50/30 p-3 text-xs text-neutral-500 sm:grid-cols-3">
            <div>
              <dt>Created</dt>
              <dd className="mt-0.5 text-neutral-700">{formatWhen(dispute.created_at)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd className="mt-0.5 text-neutral-700">{formatWhen(dispute.updated_at)}</dd>
            </div>
            <div>
              <dt>Resolved</dt>
              <dd className="mt-0.5 text-neutral-700">{formatWhen(dispute.resolved_at)}</dd>
            </div>
          </dl>

          <div>
            <button
              type="button"
              onClick={() => setShowTechnical((v) => !v)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
            >
              {showTechnical ? "Hide" : "Show"} technical references
            </button>
            {showTechnical ? (
              <dl className="mt-2 space-y-1 rounded-lg border border-neutral-100 bg-neutral-50 p-3 font-mono text-[11px] text-neutral-600">
                <div>
                  <dt className="inline text-neutral-400">Dispute </dt>
                  <dd className="inline break-all">{dispute.id}</dd>
                </div>
                <div>
                  <dt className="inline text-neutral-400">Booking </dt>
                  <dd className="inline break-all">{dispute.booking_request_id}</dd>
                </div>
                {dispute.conversation_id ? (
                  <div>
                    <dt className="inline text-neutral-400">Chat </dt>
                    <dd className="inline break-all">{dispute.conversation_id}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={confirmClose}
        title="Close this dispute?"
        confirmLabel="Close dispute"
        confirmVariant="destructive"
        loading={statusBusy}
        onCancel={() => {
          setConfirmClose(false);
          setPendingStatus(null);
          setStatus(dispute.status);
        }}
        onConfirm={() => {
          if (pendingStatus) void applyStatus(pendingStatus);
        }}
      />
    </>
  );
}
