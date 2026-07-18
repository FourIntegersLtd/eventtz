"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass, labelClass, ToggleChip } from "@/features/vendor/onboarding/steps/form-primitives";
import { parseForm, vendorPriceAdjustmentsSchema } from "@/lib/validation";
import {
  applyDraftLine,
  costNeedsReason,
  formatLineSummary,
  kindFromRow,
  legacyLabelToReason,
  previewClientTotalLabel,
  rowForKind,
  type AdjDraftRow,
  type AdjKind,
} from "@/features/vendor/bookings/vendorBookingResponseHelpers";
import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";

type VendorBookingResponseAdjustmentsProps = {
  pricing: BookingPricing | null | undefined;
  initialLines: AdjDraftRow[];
  actionBusy: boolean;
  adjSaving: boolean;
  onBack: () => void;
  onSendUpdatedPrice: (rows: AdjDraftRow[]) => void;
};

export function VendorBookingResponseAdjustments({
  pricing,
  initialLines,
  actionBusy,
  adjSaving,
  onBack,
  onSendUpdatedPrice,
}: VendorBookingResponseAdjustmentsProps) {
  const [adjKind, setAdjKind] = useState<AdjKind>(() => {
    const first = initialLines[0];
    return first ? kindFromRow(first) : "cost";
  });
  const [lines, setLines] = useState<AdjDraftRow[]>(initialLines);
  const [amountInput, setAmountInput] = useState(() => {
    const first = initialLines[0];
    const kind = first ? kindFromRow(first) : "cost";
    return rowForKind(initialLines, kind)?.amount ?? "";
  });
  const [reasonInput, setReasonInput] = useState(() => {
    const first = initialLines[0];
    const kind = first ? kindFromRow(first) : "cost";
    const active = rowForKind(initialLines, kind);
    return active && kind === "cost" ? legacyLabelToReason(active.label) : "";
  });
  const [adjError, setAdjError] = useState<string | null>(null);

  const adjustDrafts = lines;
  const previewTotal = previewClientTotalLabel(pricing, adjustDrafts);
  const otherKind: AdjKind = adjKind === "cost" ? "discount" : "cost";
  const otherLine = rowForKind(lines, otherKind);

  const syncLines = (kind: AdjKind, amount: string, reason: string) => {
    setLines((prev) => applyDraftLine(prev, kind, amount, reason));
  };

  const handleAmountChange = (raw: string) => {
    if (raw.trim().startsWith("-")) {
      const numeric = raw.replace(/^-/, "");
      setAdjKind("discount");
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

  const handleKindChange = (kind: AdjKind) => {
    setAdjKind(kind);
    const row = rowForKind(lines, kind);
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
        <p className="text-sm font-medium text-neutral-900">Suggest a new price</p>
        <p className="mt-1 text-sm text-neutral-600">Say what changed. They need to accept first.</p>
      </div>

      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <ToggleChip active={adjKind === "cost"} onClick={() => handleKindChange("cost")}>
            Add to price
          </ToggleChip>
          <ToggleChip active={adjKind === "discount"} onClick={() => handleKindChange("discount")}>
            Discount
          </ToggleChip>
        </div>

        {adjKind === "cost" ? (
          <div>
            <label className={labelClass()} htmlFor="adj-reason">
              What is this for?
            </label>
            <input
              id="adj-reason"
              type="text"
              value={reasonInput}
              maxLength={200}
              placeholder="e.g. travel, extra hour, setup fee"
              className={inputClass()}
              onChange={(e) => handleReasonChange(e.target.value)}
            />
          </div>
        ) : null}

        <div>
          <label className={labelClass()} htmlFor="adj-amount">
            {adjKind === "discount" ? "Amount off" : "Amount"}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
              £
            </span>
            <input
              id="adj-amount"
              type="text"
              inputMode="decimal"
              value={amountInput}
              placeholder="0"
              className={`${inputClass()} pl-7`}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
          </div>
          {adjKind === "discount" ? (
            <p className="mt-1.5 text-xs text-neutral-500">Type − for a discount.</p>
          ) : null}
        </div>
      </div>

      {otherLine ? (
        <p className="text-sm text-neutral-600">
          Also included:{" "}
          <span className="font-medium text-neutral-900">{formatLineSummary(otherLine)}</span>
        </p>
      ) : null}

      {adjKind === "cost" && amountInput.trim() && !reasonInput.trim() ? (
        <p className="text-xs text-amber-700">Add a reason for the extra charge.</p>
      ) : null}

      {adjError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {adjError}
        </p>
      ) : null}

      {previewTotal ? (
        <p className="text-sm text-neutral-600">
          New total for them:{" "}
          <span className="font-semibold text-neutral-900">{previewTotal}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={adjSaving || actionBusy}
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          disabled={adjSaving || actionBusy || sendDisabled}
          loading={adjSaving}
          onClick={handleSendUpdatedPrice}
        >
          Send new price
        </Button>
      </div>
    </div>
  );
}
