"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";
import { parseForm, vendorPriceAdjustmentsSchema } from "@/lib/validation";
import {
  adjustmentLineKey,
  adjustmentPreviewDeltaExplanation,
  applyDraftLine,
  costNeedsReason,
  formatLineSummary,
  formatTotalDeltaLabel,
  adjustmentKindFromRow,
  friendlyMoneyLabel,
  legacyLabelToReason,
  previewClientFeeBreakdown,
  previewTotalDeltaGbp,
  draftRowForAdjustmentKind,
  type AdjustmentDraftRow,
  type AdjustmentKind,
} from "@/features/vendor/bookings/vendorBookingResponseHelpers";
import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";

type VendorBookingResponseAdjustmentsProps = {
  pricing: BookingPricing | null | undefined;
  initialLines: AdjustmentDraftRow[];
  actionBusy: boolean;
  adjustmentSaving: boolean;
  onBack: () => void;
  onSendUpdatedPrice: (rows: AdjustmentDraftRow[]) => void;
};

export function VendorBookingResponseAdjustments({
  pricing,
  initialLines,
  actionBusy,
  adjustmentSaving,
  onBack,
  onSendUpdatedPrice,
}: VendorBookingResponseAdjustmentsProps) {
  const [adjKind, setAdjustmentKind] = useState<AdjustmentKind>(() => {
    const first = initialLines[0];
    return first ? adjustmentKindFromRow(first) : "cost";
  });
  const [lines, setLines] = useState<AdjustmentDraftRow[]>(initialLines);
  const [amountInput, setAmountInput] = useState(() => {
    const first = initialLines[0];
    const kind = first ? adjustmentKindFromRow(first) : "cost";
    return draftRowForAdjustmentKind(initialLines, kind)?.amount ?? "";
  });
  const [reasonInput, setReasonInput] = useState(() => {
    const first = initialLines[0];
    const kind = first ? adjustmentKindFromRow(first) : "cost";
    const active = draftRowForAdjustmentKind(initialLines, kind);
    return active && kind === "cost" ? legacyLabelToReason(active.label) : "";
  });
  const [adjError, setAdjError] = useState<string | null>(null);

  const adjustDrafts = lines;
  const previewBreakdown = previewClientFeeBreakdown(pricing, adjustDrafts);
  const previewDelta = previewTotalDeltaGbp(pricing, adjustDrafts);
  const previewDeltaExplanation =
    previewDelta != null
      ? adjustmentPreviewDeltaExplanation(pricing, adjustDrafts, previewDelta)
      : null;
  const currentTotalLabel = pricing?.client_total_label
    ? friendlyMoneyLabel(pricing.client_total_label)
    : null;

  const syncLines = (kind: AdjustmentKind, amount: string, reason: string) => {
    setLines((prev) => applyDraftLine(prev, kind, amount, reason));
  };

  const handleRemoveDraft = (kind: AdjustmentKind) => {
    const nextLines = applyDraftLine(lines, kind, "", "");
    setLines(nextLines);
    if (kind === adjKind) {
      setAmountInput("");
      if (kind === "cost") setReasonInput("");
    }
  };

  const handleAmountChange = (raw: string) => {
    if (raw.trim().startsWith("-")) {
      const numeric = raw.replace(/^-/, "");
      setAdjustmentKind("discount");
      setAmountInput(numeric);
      setReasonInput("");
      syncLines("discount", numeric, "");
      return;
    }
    setAmountInput(raw);
    syncLines(adjKind, raw, reasonInput);
  };

  const handleReasonChange = (raw: string) => {
    setReasonInput(raw);
    syncLines("cost", amountInput, raw);
  };

  const handleKindChange = (kind: AdjustmentKind) => {
    setAdjustmentKind(kind);
    const row = draftRowForAdjustmentKind(lines, kind);
    setAmountInput(row?.amount ?? "");
    setReasonInput(kind === "cost" && row ? legacyLabelToReason(row.label) : "");
  };

  const sendDisabled = useMemo(() => {
    if (adjustDrafts.length === 0) return true;
    if (costNeedsReason(adjustDrafts)) return true;
    if (adjKind === "cost" && amountInput.trim() && !reasonInput.trim()) return true;
    return false;
  }, [adjustDrafts, adjKind, amountInput, reasonInput]);

  const handleSendUpdatedPrice = () => {
    setAdjError(null);
    const parsed = parseForm(vendorPriceAdjustmentsSchema, {
      rows: adjustDrafts.map((row) => ({
        kind: row.kind,
        amount: row.amount,
        reason: row.kind === "cost" ? row.label : "",
      })),
    });
    if (!parsed.ok) {
      setAdjError(parsed.formError);
      return;
    }
    onSendUpdatedPrice(adjustDrafts);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">Suggest a new price</p>
        <p className="mt-1 text-sm text-ink-2">Say what changed. They need to accept first.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <Chip active={adjKind === "cost"} onClick={() => handleKindChange("cost")}>
              Add to price
            </Chip>
            <Chip active={adjKind === "discount"} onClick={() => handleKindChange("discount")}>
              Discount
            </Chip>
          </div>

          {adjKind === "cost" ? (
            <div>
              <TextField
                id="adj-reason"
                label="What is this for?"
                type="text"
                value={reasonInput}
                maxLength={200}
                placeholder="e.g. travel, extra hour, setup fee"
                onChange={(e) => handleReasonChange(e.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="ez-label" htmlFor="adj-amount">
              {adjKind === "discount" ? "Amount off" : "Amount"}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">
                £
              </span>
              <input
                id="adj-amount"
                type="text"
                inputMode="decimal"
                value={amountInput}
                placeholder="0"
                className="ez-input pl-7"
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
            {adjKind === "discount" ? (
              <p className="mt-1.5 text-xs text-ink-3">Type − for a discount.</p>
            ) : null}
          </div>

          {adjKind === "cost" && amountInput.trim() && !reasonInput.trim() ? (
            <p className="text-xs text-amber-700">Add a reason for the extra charge.</p>
          ) : null}
        </div>

        {lines.length > 0 || (previewDelta != null && previewBreakdown) ? (
          <div className="space-y-3 border-t border-line bg-surface-3 px-4 py-3">
            {lines.length > 0 ? (
              <ul className="space-y-2">
                {lines.map((row) => (
                  <li
                    key={adjustmentLineKey(row)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2"
                  >
                    <span className="min-w-0 text-sm text-ink">{formatLineSummary(row)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDraft(row.kind)}
                      aria-label={`Remove ${row.kind === "discount" ? "discount" : "extra charge"}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition hover:bg-surface-3 hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {previewDelta != null && previewBreakdown ? (
              <div className="text-sm text-ink-2">
                <p>
                  New total for them:{" "}
                  <span className="font-semibold text-ink">{previewBreakdown.totalLabel}</span>
                  {currentTotalLabel ? (
                    <span className="text-ink-3"> (was {currentTotalLabel})</span>
                  ) : null}
                </p>
                <p className="mt-1 text-ink-2">
                  {previewDeltaExplanation ??
                    `${formatTotalDeltaLabel(previewDelta)} from their current total.`}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {adjError ? <LottieFailureInline message={adjError} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={adjustmentSaving || actionBusy}
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          disabled={adjustmentSaving || actionBusy || sendDisabled}
          loading={adjustmentSaving}
          onClick={handleSendUpdatedPrice}
        >
          Send new price
        </Button>
      </div>
    </div>
  );
}
