"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminSuccessBanner,
  formatDate,
  formatGbp,
  humanize,
  isSuperAdmin,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminDisputes, patchAdminDispute, type AdminDisputeCase } from "@/domains/admin-trust/api";

const STATUS_FILTERS = ["open", "under_review", "resolved", "closed", "all"] as const;

/**
 * Trust tab: disputes. Any admin can triage (status/notes/assignment);
 * setting a money-moving `resolution_action` (refund or payout) is gated to
 * super admins, matching the baseline's `canResolveDisputesFinancially`.
 */
export function AdminDisputesPanel() {
  const { session } = useSession();
  const canResolveFinancially = isSuperAdmin(session);

  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [disputes, setDisputes] = useState<AdminDisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resolutionAction, setResolutionAction] = useState<"release_to_vendor" | "refund_client" | "partial_refund" | "">("");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      setDisputes(await fetchAdminDisputes(status));
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load disputes.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const openDispute = disputes.find((dispute) => dispute.id === openId) ?? null;

  async function handleStatusChange(disputeId: string, nextStatus: AdminDisputeCase["status"]) {
    setSaving(true);
    setNotice(null);
    try {
      const updated = await patchAdminDispute(disputeId, { status: nextStatus });
      setDisputes((current) => current.map((dispute) => (dispute.id === disputeId ? updated : dispute)));
      setNotice("Dispute updated.");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not update the dispute.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveFinancially(disputeId: string) {
    if (!resolutionAction) return;
    setSaving(true);
    setNotice(null);
    try {
      const updated = await patchAdminDispute(disputeId, {
        status: "resolved",
        resolution_action: resolutionAction,
        resolution_note: resolutionNote || null,
        refund_amount_gbp: resolutionAction === "partial_refund" ? Number(refundAmount) : null,
      });
      setDisputes((current) => current.map((dispute) => (dispute.id === disputeId ? updated : dispute)));
      setNotice("Dispute resolved.");
      setResolutionAction("");
      setRefundAmount("");
      setResolutionNote("");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not resolve the dispute.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatus(option)}
            className={
              status === option
                ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary"
            }
          >
            {humanize(option)}
          </button>
        ))}
      </div>

      {notice ? <AdminSuccessBanner message={notice} /> : null}
      {loading ? <AdminLoadingState label="Loading disputes…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && disputes.length === 0 ? <AdminEmptyState title="No disputes in this bucket" /> : null}

      <div className="space-y-3">
        {disputes.map((dispute) => (
          <div key={dispute.id} className="rounded-2xl border border-primary-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{dispute.event_name ?? "Booking dispute"}</p>
                <p className="text-xs text-neutral-500">
                  Opened {formatDate(dispute.created_at)} by {dispute.opened_by_display_name ?? dispute.opened_by_role}
                </p>
              </div>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                {humanize(dispute.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-700">{dispute.summary}</p>
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-primary hover:underline"
              onClick={() => setOpenId(openId === dispute.id ? null : dispute.id)}
            >
              {openId === dispute.id ? "Hide details" : "View and triage"}
            </button>

            {openDispute?.id === dispute.id ? (
              <div className="mt-3 space-y-3 border-t border-primary-border pt-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-neutral-500">Client</dt>
                  <dd>{dispute.client_email ?? "-"}</dd>
                  <dt className="text-neutral-500">Vendor</dt>
                  <dd>{dispute.vendor_display_name ?? "-"}</dd>
                  <dt className="text-neutral-500">Refund amount</dt>
                  <dd>{dispute.refund_amount_gbp != null ? formatGbp(dispute.refund_amount_gbp) : "-"}</dd>
                  <dt className="text-neutral-500">Resolution</dt>
                  <dd>{dispute.resolution_action ? humanize(dispute.resolution_action) : "-"}</dd>
                </dl>

                <div className="flex flex-wrap gap-2">
                  {(["under_review", "closed"] as const).map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant="secondary"
                      loading={saving}
                      onClick={() => void handleStatusChange(dispute.id, nextStatus)}
                    >
                      Mark {humanize(nextStatus)}
                    </Button>
                  ))}
                </div>

                {canResolveFinancially ? (
                  <div className="space-y-2 rounded-xl border border-primary-border bg-primary-soft/40 p-3">
                    <p className="text-xs font-semibold text-neutral-900">Resolve financially</p>
                    <select
                      value={resolutionAction}
                      onChange={(event) =>
                        setResolutionAction(event.target.value as typeof resolutionAction)
                      }
                      className="w-full rounded-lg border border-primary-border px-2 py-1.5 text-sm"
                    >
                      <option value="">Choose an action</option>
                      <option value="release_to_vendor">Release to vendor</option>
                      <option value="refund_client">Refund client in full</option>
                      <option value="partial_refund">Partial refund</option>
                    </select>
                    {resolutionAction === "partial_refund" ? (
                      <input
                        type="number"
                        placeholder="Refund amount (GBP)"
                        value={refundAmount}
                        onChange={(event) => setRefundAmount(event.target.value)}
                        className="w-full rounded-lg border border-primary-border px-2 py-1.5 text-sm"
                      />
                    ) : null}
                    <textarea
                      placeholder="Resolution note"
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-primary-border px-2 py-1.5 text-sm"
                    />
                    <Button
                      loading={saving}
                      disabled={!resolutionAction}
                      onClick={() => void handleResolveFinancially(dispute.id)}
                    >
                      Resolve dispute
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Refunding the client or paying the vendor is limited to super admins.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
