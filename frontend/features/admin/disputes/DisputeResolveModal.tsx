"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { patchAdminDispute, type AdminDisputeCase } from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { adminPartialRefundSchema, parseForm } from "@/lib/validation";
import { z } from "zod";
import { RESOLUTION_ACTIONS, resolutionActionLabel } from "./disputeFormatters";

const disputeNoteSchema = z.object({
  note: z.string().trim().max(8000, "Message is too long."),
});

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
    let refundAmountGbp: number | null = null;
    if (action === "partial_refund") {
      const parsed = parseForm(adminPartialRefundSchema, {
        amount: refundAmount,
        note,
      });
      if (!parsed.ok) {
        setError(parsed.formError);
        return;
      }
      refundAmountGbp = parsed.data.amount;
    } else {
      const parsed = parseForm(disputeNoteSchema, { note });
      if (!parsed.ok) {
        setError(parsed.formError);
        return;
      }
    }
    setBusy(true);
    try {
      await patchAdminDispute(dispute.id, {
        status: "resolved",
        resolution_action: action,
        refund_amount_gbp: refundAmountGbp,
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
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={busy} onClick={() => void submit()}>
            Resolve & move money
          </Button>
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
