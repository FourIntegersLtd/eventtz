"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ADMIN_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { Drawer } from "@/components/ui/Drawer";
import { patchAdminDispute, type AdminDisputeCase } from "@/lib/adminPlatformApi";
import { fetchAdminTeam, type AdminTeamMember } from "@/lib/adminTeamApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { DisputePartiesPanel } from "./DisputePartiesSummary";
import {
  DISPUTE_STATUSES,
  disputeBookingLabel,
  resolutionActionLabel,
} from "./disputeFormatters";
import { participantDisputeStatusLabel } from "@/lib/bookingDisputeHelpers";
import { AdminChatThread } from "@/features/admin/chat/AdminChatThread";

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
  const { canResolveDisputesFinancially } = useAdminPermissions();
  const [sharedNote, setSharedNote] = useState(dispute.resolution_note ?? "");
  const [noteAudience, setNoteAudience] = useState<"client" | "vendor" | "both">("both");
  const [status, setStatus] = useState(dispute.status);
  const [noteBusy, setNoteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<AdminDisputeCase["status"] | null>(null);
  const [team, setTeam] = useState<AdminTeamMember[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    void fetchAdminTeam()
      .then(setTeam)
      .catch(() => setTeam([]));
  }, []);

  useEffect(() => {
    const clientNote = (dispute.client_resolution_note ?? "").trim();
    const vendorNote = (dispute.vendor_resolution_note ?? "").trim();
    const legacy = (dispute.resolution_note ?? "").trim();
    if (clientNote && vendorNote && clientNote === vendorNote) {
      setNoteAudience("both");
      setSharedNote(clientNote);
    } else if (clientNote && !vendorNote) {
      setNoteAudience("client");
      setSharedNote(clientNote);
    } else if (vendorNote && !clientNote) {
      setNoteAudience("vendor");
      setSharedNote(vendorNote);
    } else if (clientNote && vendorNote) {
      setNoteAudience("client");
      setSharedNote(clientNote);
    } else {
      setNoteAudience("both");
      setSharedNote(legacy);
    }
    setStatus(dispute.status);
    setChatOpen(false);
  }, [
    dispute.id,
    dispute.resolution_note,
    dispute.client_resolution_note,
    dispute.vendor_resolution_note,
    dispute.status,
  ]);

  const canResolve =
    canResolveDisputesFinancially &&
    (dispute.status === "open" || dispute.status === "under_review");

  const saveSharedNote = async () => {
    setError(null);
    setNoteBusy(true);
    try {
      const text = sharedNote.trim() || null;
      const body: Parameters<typeof patchAdminDispute>[1] = {};
      if (noteAudience === "client" || noteAudience === "both") {
        body.client_resolution_note = text;
      }
      if (noteAudience === "vendor" || noteAudience === "both") {
        body.vendor_resolution_note = text;
      }
      if (noteAudience === "both") {
        body.resolution_note = text;
      }
      await patchAdminDispute(dispute.id, body);
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

  const assignAdmin = async (adminId: string | null) => {
    setError(null);
    setAssignBusy(true);
    try {
      await patchAdminDispute(dispute.id, { assigned_admin_id: adminId });
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
        widthClassName="max-w-xl"
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
        <div className="space-y-4 text-sm">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              {error}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
            <div className="px-5 py-4">
              {dispute.resolution_action ? (
                <p className="mb-2 text-[13px] text-neutral-500">
                  {resolutionActionLabel(dispute.resolution_action)}
                </p>
              ) : null}
              <p className="text-[13px] font-medium text-neutral-500">What was reported</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
                {dispute.summary}
              </p>
            </div>

            <div className="border-t border-neutral-100 px-5 py-4">
              <DisputePartiesPanel
                dispute={dispute}
                actions={
                  <>
                    <Link
                      href={`/admin/bookings/${dispute.booking_request_id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open booking
                    </Link>
                    {dispute.conversation_id ? (
                      <Button
                        variant={chatOpen ? "primary" : "secondary"}
                        size="sm"
                        icon={<MessageSquare className="h-4 w-4" aria-hidden />}
                        onClick={() => setChatOpen((open) => !open)}
                      >
                        {chatOpen ? "Hide messages" : "Review messages"}
                      </Button>
                    ) : null}
                  </>
                }
              />
              {chatOpen && dispute.conversation_id ? (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <AdminChatThread conversationId={dispute.conversation_id} compact />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 border-t border-neutral-100 px-5 py-4 sm:grid-cols-2">
              <div>
                <label htmlFor="dispute-status" className="mb-1.5 block text-[13px] text-neutral-500">
                  Status
                </label>
                <select
                  id="dispute-status"
                  value={status}
                  disabled={statusBusy}
                  onChange={(e) => {
                    const next = e.target.value as AdminDisputeCase["status"];
                    if (next === "resolved") {
                      if (canResolveDisputesFinancially) {
                        onResolve(dispute);
                      }
                      return;
                    }
                    setStatus(next);
                    onStatusSelect(next);
                  }}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"
                >
                  {DISPUTE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {participantDisputeStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="dispute-assignee"
                  className="mb-1.5 block text-[13px] text-neutral-500"
                >
                  Assigned to
                </label>
                <select
                  id="dispute-assignee"
                  value={dispute.assigned_admin_id ?? ""}
                  disabled={assignBusy}
                  onChange={(e) => {
                    const next = e.target.value || null;
                    void assignAdmin(next);
                  }}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {team
                    .filter((m) => !m.account_suspended)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.email ?? m.user_id}
                        {m.user_id === user?.id ? " (you)" : ""}
                      </option>
                    ))}
                </select>
                {user?.id && dispute.assigned_admin_id !== user.id ? (
                  <button
                    type="button"
                    disabled={assignBusy}
                    onClick={() => void assignAdmin(user.id)}
                    className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Assign to me
                  </button>
                ) : null}
              </div>
            </div>

            <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
              <p className="text-[13px] font-medium text-neutral-500">Message to parties</p>
              <p className="mt-1 text-[13px] text-neutral-400">
                Shown on their dispute page — not as a chat message.
              </p>
              <fieldset className="mt-3">
                <legend className="sr-only">Message audience</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "client" as const, label: "Client only" },
                      { value: "vendor" as const, label: "Vendor only" },
                      { value: "both" as const, label: "Both" },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        noteAudience === opt.value
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="dispute-note-audience"
                        className="sr-only"
                        checked={noteAudience === opt.value}
                        onChange={() => {
                          setNoteAudience(opt.value);
                          const clientNote = (dispute.client_resolution_note ?? "").trim();
                          const vendorNote = (dispute.vendor_resolution_note ?? "").trim();
                          const legacy = (dispute.resolution_note ?? "").trim();
                          if (opt.value === "client") {
                            setSharedNote(clientNote || legacy);
                          } else if (opt.value === "vendor") {
                            setSharedNote(vendorNote || legacy);
                          } else {
                            setSharedNote(
                              clientNote && vendorNote && clientNote === vendorNote
                                ? clientNote
                                : clientNote || vendorNote || legacy,
                            );
                          }
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <textarea
                id="dispute-shared-note"
                value={sharedNote}
                onChange={(e) => setSharedNote(e.target.value)}
                rows={4}
                className="mt-3 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"
                placeholder="Your message…"
              />
              {(dispute.client_resolution_note ||
                dispute.vendor_resolution_note ||
                dispute.resolution_note) &&
              noteAudience !== "both" ? (
                <p className="mt-2 text-xs text-neutral-500">
                  {noteAudience === "client"
                    ? dispute.vendor_resolution_note
                      ? "Vendor already has a separate message saved."
                      : null
                    : dispute.client_resolution_note
                      ? "Client already has a separate message saved."
                      : null}
                </p>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                loading={noteBusy}
                onClick={() => void saveSharedNote()}
              >
                Save message
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={confirmClose}
        title={ADMIN_CONFIRM_COPY.closeDispute.title}
        description={ADMIN_CONFIRM_COPY.closeDispute.description}
        confirmLabel={ADMIN_CONFIRM_COPY.closeDispute.confirmLabel}
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
