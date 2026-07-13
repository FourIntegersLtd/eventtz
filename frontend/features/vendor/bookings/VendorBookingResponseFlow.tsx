"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BOOKING_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { inputClass, labelClass, ToggleChip } from "@/components/vendor-onboarding/steps/form-primitives";
import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";

type AdjDraftRow = {
  kind: "cost" | "discount";
  tag: string;
  label: string;
  amount: string;
};

type AdjKind = "cost" | "discount";

type VendorBookingResponseFlowProps = {
  detail: VendorBookingDetail;
  actionBusy: boolean;
  adjSaving: boolean;
  onAcceptAtListedPrice: () => void;
  onDecline: () => void;
  onSendUpdatedPrice: (rows: AdjDraftRow[]) => void;
};

function friendlyMoneyLabel(label: string): string {
  const match = label.match(/GBP\s*([\d,.]+)/i);
  if (match) return `£${match[1]}`;
  return label;
}

function formatGbp(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const s = rounded.toFixed(2);
  const display = s.endsWith(".00") ? String(Math.round(rounded)) : s;
  return `£${display}`;
}

function previewClientTotalLabel(
  pricing: BookingPricing | null | undefined,
  drafts: AdjDraftRow[],
): string | null {
  if (!pricing || pricing.has_pricing_tbc) return null;
  const draftTotal = drafts.reduce((sum, row) => {
    const raw = Number.parseFloat(row.amount);
    if (!Number.isFinite(raw) || raw <= 0) return sum;
    return sum + (row.kind === "discount" ? -raw : raw);
  }, 0);
  const lineSubtotal = pricing.line_items_subtotal_gbp;
  const vendorPortion = lineSubtotal + draftTotal;
  if (vendorPortion <= 0) return null;
  const feePct = pricing.service_fee_percent || getBookingServiceFeePercent();
  const feeBase = Math.max(0, lineSubtotal + Math.min(draftTotal, 0));
  const fee = (feeBase * feePct) / 100;
  return formatGbp(vendorPortion + fee);
}

function lineKey(row: Pick<AdjDraftRow, "kind" | "tag">): string {
  return `${row.kind}:${row.tag}`;
}

function rowForKind(lines: AdjDraftRow[], kind: AdjKind): AdjDraftRow | undefined {
  const tag = kind === "discount" ? "discount" : "other";
  return lines.find((l) => l.kind === kind && l.tag === tag);
}

function applyDraftLine(
  lines: AdjDraftRow[],
  kind: AdjKind,
  rawAmount: string,
  reason: string,
): AdjDraftRow[] {
  const tag = kind === "discount" ? "discount" : "other";
  const without = lines.filter((l) => lineKey(l) !== `${kind}:${tag}`);
  const numeric = Number.parseFloat(rawAmount.replace(/^-/, "").trim());
  if (!rawAmount.trim() || !Number.isFinite(numeric) || numeric <= 0) return without;
  return [
    ...without,
    {
      kind,
      tag,
      label: kind === "discount" ? "Discount" : reason.trim() || "",
      amount: String(numeric),
    },
  ];
}

function kindFromRow(row: AdjDraftRow): AdjKind {
  return row.kind === "discount" ? "discount" : "cost";
}

function legacyLabelToReason(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "Delivery or travel" || trimmed === "Other" || trimmed === "Additional cost") {
    return "";
  }
  return trimmed;
}

function draftsFromDetail(detail: VendorBookingDetail): AdjDraftRow[] {
  return detail.vendor_adjustments.map((a) => ({
    kind: a.amount_gbp < 0 ? "discount" : "cost",
    tag: a.tag || "other",
    label: a.label,
    amount: String(Math.abs(a.amount_gbp)),
  }));
}

function hasSavedPriceUpdate(detail: VendorBookingDetail): boolean {
  return detail.vendor_adjustments.length > 0;
}

function formatLineSummary(row: AdjDraftRow): string {
  const amount = formatGbp(Number.parseFloat(row.amount));
  if (row.kind === "discount") return `Discount −${amount}`;
  return `${row.label || "Extra charge"} +${amount}`;
}

function costNeedsReason(lines: AdjDraftRow[]): boolean {
  return lines.some((row) => row.kind === "cost" && row.amount.trim() && !row.label.trim());
}

export function VendorBookingResponseFlow({
  detail,
  actionBusy,
  adjSaving,
  onAcceptAtListedPrice,
  onDecline,
  onSendUpdatedPrice,
}: VendorBookingResponseFlowProps) {
  const listedTotal =
    detail.pricing?.client_total_label ??
    detail.initial_client_total_label ??
    detail.total_label;
  const friendlyTotal = friendlyMoneyLabel(listedTotal);

  const waitingForClient = hasSavedPriceUpdate(detail);
  const [step, setStep] = useState<"review" | "adjust">("review");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [adjKind, setAdjKind] = useState<AdjKind>("cost");
  const [lines, setLines] = useState<AdjDraftRow[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");

  const adjustDrafts = lines;
  const previewTotal = previewClientTotalLabel(detail.pricing, adjustDrafts);
  const otherKind: AdjKind = adjKind === "cost" ? "discount" : "cost";
  const otherLine = rowForKind(lines, otherKind);

  const openAdjust = (saved: AdjDraftRow[]) => {
    setLines(saved);
    const first = saved[0];
    const kind = first ? kindFromRow(first) : "cost";
    const active = rowForKind(saved, kind);
    setAdjKind(kind);
    setAmountInput(active?.amount ?? "");
    setReasonInput(active && kind === "cost" ? legacyLabelToReason(active.label) : "");
    setStep("adjust");
  };

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

  if (waitingForClient && step !== "adjust") {
    const currentTotal = friendlyMoneyLabel(
      detail.pricing?.client_total_label ?? detail.total_label,
    );
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">
          Waiting for them to accept your new price ({currentTotal}).
        </p>
        <button
          type="button"
          onClick={() => openAdjust(draftsFromDetail(detail))}
          className="text-sm font-medium text-primary hover:underline"
        >
          Edit price
        </button>
      </div>
    );
  }

  if (step === "adjust") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-neutral-900">Suggest a new price</p>
          <p className="mt-1 text-sm text-neutral-600">
            Say what changed. They need to accept first.
          </p>
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
            Also included: <span className="font-medium text-neutral-900">{formatLineSummary(otherLine)}</span>
          </p>
        ) : null}

        {adjKind === "cost" && amountInput.trim() && !reasonInput.trim() ? (
          <p className="text-xs text-amber-700">Add a reason for the extra charge.</p>
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
            onClick={() => setStep("review")}
          >
            Back
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            disabled={adjSaving || actionBusy || sendDisabled}
            loading={adjSaving}
            onClick={() => onSendUpdatedPrice(adjustDrafts)}
          >
            Send new price
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">
          Their estimate:{" "}
          <span className="font-semibold text-neutral-900">{friendlyTotal}</span>
          <span className="text-neutral-500"> (incl. Eventtz fee)</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            disabled={actionBusy || adjSaving}
            loading={actionBusy}
            onClick={onAcceptAtListedPrice}
          >
            Accept booking
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={actionBusy || adjSaving}
            onClick={() => openAdjust([])}
          >
            Suggest a different price
          </Button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={actionBusy || adjSaving}
            onClick={() => setDeclineOpen(true)}
            className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
          >
            Can&apos;t take this one
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={declineOpen}
        title={BOOKING_CONFIRM_COPY.declineBooking.title}
        description={BOOKING_CONFIRM_COPY.declineBooking.description}
        cancelLabel={BOOKING_CONFIRM_COPY.declineBooking.cancelLabel}
        confirmLabel={BOOKING_CONFIRM_COPY.declineBooking.confirmLabel}
        confirmLoadingLabel={BOOKING_CONFIRM_COPY.declineBooking.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={actionBusy}
        onCancel={() => setDeclineOpen(false)}
        onConfirm={() => {
          setDeclineOpen(false);
          onDecline();
        }}
      />
    </>
  );
}
