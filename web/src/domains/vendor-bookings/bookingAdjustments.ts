import type { VendorAdjustmentIn } from "@/domains/vendor-bookings/api";

/** One row of the adjustments editor, before it is validated into an API payload. */
export interface AdjustmentDraftRow {
  kind: "cost" | "discount";
  label: string;
  /** The amount the vendor typed, always entered as a positive number regardless of `kind`. */
  amount: string;
  tag: string;
}

export interface AdjustmentsPayloadError {
  ok: false;
  error: string;
}

export interface AdjustmentsPayloadSuccess {
  ok: true;
  adjustments: VendorAdjustmentIn[];
}

/** An empty extra-cost row, for the editor's "add a line" button. */
export function emptyAdjustmentRow(kind: AdjustmentDraftRow["kind"]): AdjustmentDraftRow {
  return { kind, label: "", amount: "", tag: "other" };
}

/**
 * Turns the editor's draft rows into `PUT .../adjustments`'s body, or an
 * error to show instead of submitting.
 *
 * Never trusts the vendor's arithmetic: this only reshapes what they typed
 * (a positive amount per row, sign applied from `kind`) — the server
 * recomputes the booking's total from these amounts, per AGENTS.md's rule
 * against trusting a client-supplied price.
 */
export function buildAdjustmentsPayload(
  rows: readonly AdjustmentDraftRow[],
): AdjustmentsPayloadError | AdjustmentsPayloadSuccess {
  if (rows.length === 0) return { ok: false, error: "Add a charge or discount first." };

  const adjustments: VendorAdjustmentIn[] = [];
  for (const row of rows) {
    const amount = Number.parseFloat(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Each line needs a valid positive amount." };
    }
    if (row.kind === "cost" && !row.label.trim()) {
      return { ok: false, error: "Say what each extra charge is for." };
    }
    adjustments.push({
      tag: row.tag.trim() || "other",
      label: row.label.trim() || (row.kind === "discount" ? "Discount" : "Additional cost"),
      amount_gbp: row.kind === "discount" ? -amount : amount,
    });
  }
  return { ok: true, adjustments };
}
