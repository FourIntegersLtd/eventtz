"use client";

import { useState } from "react";
import { Button } from "@/foundation/ui";
import { buildAdjustmentsPayload, emptyAdjustmentRow, type AdjustmentDraftRow } from "@/domains/vendor-bookings/bookingAdjustments";
import type { VendorAdjustmentIn } from "@/domains/vendor-bookings/api";

/**
 * Lets the vendor add extra costs or discounts to a pending, client-sent
 * enquiry before accepting it. The client must re-confirm the new price
 * (server behaviour, not enforced here) — this form only builds and submits
 * the row list, never a total: the server recomputes it.
 */
export function AdjustmentsForm({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: (adjustments: VendorAdjustmentIn[]) => void;
}) {
  const [rows, setRows] = useState<AdjustmentDraftRow[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<AdjustmentDraftRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function submit() {
    const result = buildAdjustmentsPayload(rows);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    onSave(result.adjustments);
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2 rounded-xl bg-neutral-50 p-3">
          <label className="flex-1 basis-40">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Label</span>
            <input
              value={row.label}
              onChange={(event) => updateRow(index, { label: event.target.value })}
              className="w-full rounded-lg border border-primary-border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
            />
          </label>
          <label className="w-28">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Amount (£)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={row.amount}
              onChange={(event) => updateRow(index, { amount: event.target.value })}
              className="w-full rounded-lg border border-primary-border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
            />
          </label>
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
            {row.kind === "discount" ? "Discount" : "Extra cost"}
          </span>
          <button type="button" onClick={() => removeRow(index)} className="text-xs font-medium text-red-600 hover:underline">
            Remove
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setRows((current) => [...current, emptyAdjustmentRow("cost")])}>
          Add extra cost
        </Button>
        <Button type="button" variant="secondary" onClick={() => setRows((current) => [...current, emptyAdjustmentRow("discount")])}>
          Add discount
        </Button>
      </div>

      {formError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{formError}</p>
      ) : null}

      {rows.length > 0 ? (
        <Button type="button" loading={saving} onClick={submit}>
          Send updated price
        </Button>
      ) : null}
    </div>
  );
}
