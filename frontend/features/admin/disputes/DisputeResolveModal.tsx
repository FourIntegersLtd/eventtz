"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { patchAdminDispute, type AdminDisputeCase } from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { RESOLUTION_ACTIONS, resolutionActionLabel } from "./disputeFormatters";

type DisputeResolveModalProps = {
  dispute: AdminDisputeCase;
  onClose: () => void;
  onResolved: () => void;
};

export function DisputeResolveModal({ dispute, onClose, onResolved }: DisputeResolveModalProps) {
  const [action, setAction] = useState<NonNullable<AdminDisputeCase["resolution_action"]>>(
    "release_to_vendor",
  );
  const [refundAmount, setRefundAmount] = useState("");
  const [note, setNote] = useState(dispute.resolution_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (action === "partial_refund") {
      const amt = Number.parseFloat(refundAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setError("Enter a valid refund amount greater than £0.");
        return;
      }
    }
    setBusy(true);
    try {
      await patchAdminDispute(dispute.id, {
        status: "resolved",
        resolution_action: action,
        refund_amount_gbp: action === "partial_refund" ? Number.parseFloat(refundAmount) : null,
        resolution_note: note.trim() || null,
      });
      onResolved();
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not resolve this dispute.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Resolve dispute"
      maxWidthClassName="max-w-md"
      zIndexClassName="z-[70]"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Resolving…" : "Resolve & move money"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">{error}</p>
        ) : null}
        <div>
          <label className="text-sm font-medium text-neutral-700">Decision</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as typeof action)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          >
            {RESOLUTION_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {resolutionActionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        {action === "partial_refund" ? (
          <div>
            <label className="text-sm font-medium text-neutral-700">Refund amount (£)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </div>
        ) : null}
        <div>
          <label className="text-sm font-medium text-neutral-700">Message for both parties</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          />
        </div>
      </div>
    </Modal>
  );
}
