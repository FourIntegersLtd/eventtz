"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { adminCard } from "@/features/admin/adminTheme";
import { patchAdminDispute, type AdminDisputeCase } from "@/lib/adminPlatformApi";
import { fetchAdminTeam, type AdminTeamMember } from "@/lib/adminTeamApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { DisputePanelSection, DisputePartiesPanel } from "./DisputePartiesSummary";
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
  const [sharedNote, setSharedNote] = useState(dispute.resolution_note ?? "");
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
    setSharedNote(dispute.resolution_note ?? "");
    setStatus(dispute.status);
    setChatOpen(false);
  }, [dispute.id, dispute.resolution_note, dispute.status]);

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
        <div className="space-y-8 text-sm">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">{error}</p>
          ) : null}

          <DisputePanelSection label="Report">
            {dispute.resolution_action ? (
              <p className="text-xs text-neutral-500">{resolutionActionLabel(dispute.resolution_action)}</p>
            ) : null}
            <p className="whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50/70 px-4 py-3.5 leading-relaxed text-neutral-900">
              {dispute.summary}
            </p>
          </DisputePanelSection>

          <DisputePanelSection label="Booking">
            <div className={`${adminCard} p-4`}>
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
                <div className="mt-5 border-t border-neutral-100 pt-5">
                  <AdminChatThread conversationId={dispute.conversation_id} compact />
                </div>
              ) : null}
            </div>
          </DisputePanelSection>

          <DisputePanelSection label="Case">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="dispute-status" className="mb-1.5 block text-sm text-neutral-700">
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
                <label htmlFor="dispute-assignee" className="mb-1.5 block text-sm text-neutral-700">
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
          </DisputePanelSection>

          <DisputePanelSection label="Message">
            <div>
              <label htmlFor="dispute-shared-note" className="mb-1.5 block text-sm text-neutral-700">
                For client and vendor
              </label>
              <textarea
                id="dispute-shared-note"
                value={sharedNote}
                onChange={(e) => setSharedNote(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
                placeholder="Your message…"
              />
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
          </DisputePanelSection>
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
