import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";
import {
  type ClientFeeBreakdown,
  computeClientFeeBreakdown,
  referralDiscountForBookingPreview,
} from "@/lib/bookingServiceFee";

export type AdjustmentDraftRow = {
  kind: "cost" | "discount";
  tag: string;
  label: string;
  amount: string;
};

export type AdjustmentKind = "cost" | "discount";

export function friendlyMoneyLabel(label: string): string {
  const match = label.match(/GBP\s*([\d,.]+)/i);
  if (match) return `£${match[1]}`;
  return label;
}

export function formatGbp(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const s = rounded.toFixed(2);
  const display = s.endsWith(".00") ? String(Math.round(rounded)) : s;
  return `£${display}`;
}

function draftAdjustmentsTotalGbp(drafts: AdjustmentDraftRow[]): number {
  return drafts.reduce((sum, row) => {
    const raw = Number.parseFloat(row.amount);
    if (!Number.isFinite(raw) || raw <= 0) return sum;
    return sum + (row.kind === "discount" ? -raw : raw);
  }, 0);
}

function vendorPortionFromDrafts(
  pricing: BookingPricing,
  drafts: AdjustmentDraftRow[],
): number | null {
  const vendorPortion = pricing.line_items_subtotal_gbp + draftAdjustmentsTotalGbp(drafts);
  if (vendorPortion <= 0) return null;
  return vendorPortion;
}

export function previewClientFeeBreakdown(
  pricing: BookingPricing | null | undefined,
  drafts: AdjustmentDraftRow[],
): ClientFeeBreakdown | null {
  if (!pricing || pricing.has_pricing_tbc) return null;
  const vendorPortion = vendorPortionFromDrafts(pricing, drafts);
  if (vendorPortion == null) return null;
  const referralDiscount = referralDiscountForBookingPreview(pricing, vendorPortion);
  return computeClientFeeBreakdown({
    vendorPortionGbp: vendorPortion,
    feePercent: pricing.service_fee_percent,
    referralFeeDiscountGbp: referralDiscount,
  });
}

export function previewClientTotalLabel(
  pricing: BookingPricing | null | undefined,
  drafts: AdjustmentDraftRow[],
): string | null {
  return previewClientFeeBreakdown(pricing, drafts)?.totalLabel ?? null;
}

/** Change in client total vs the booking's current stored total. */
export function previewTotalDeltaGbp(
  pricing: BookingPricing | null | undefined,
  drafts: AdjustmentDraftRow[],
): number | null {
  const breakdown = previewClientFeeBreakdown(pricing, drafts);
  const currentTotal = pricing?.client_total_gbp;
  if (!breakdown || currentTotal == null || !Number.isFinite(currentTotal)) return null;
  const delta = Math.round((breakdown.totalGbp - currentTotal) * 100) / 100;
  if (delta === 0) return null;
  return delta;
}

export function formatTotalDeltaLabel(delta: number): string {
  const abs = formatGbp(Math.abs(delta));
  if (delta > 0) return `+${abs}`;
  if (delta < 0) return `−${abs}`;
  return abs;
}

/** Plain-language split when a draft changes the client total by more than the vendor amount. */
export function adjustmentPreviewDeltaExplanation(
  pricing: BookingPricing | null | undefined,
  drafts: AdjustmentDraftRow[],
  deltaGbp: number,
): string | null {
  const vendorDelta = draftAdjustmentsTotalGbp(drafts);
  if (vendorDelta === 0 || deltaGbp === 0) return null;

  const feePct = pricing?.service_fee_percent ?? 5;
  const deltaLabel = formatTotalDeltaLabel(deltaGbp);

  if (vendorDelta > 0 && deltaGbp > 0) {
    const feeExtra = Math.round((deltaGbp - vendorDelta) * 100) / 100;
    if (feeExtra <= 0) return null;
    return `${deltaLabel} for them: ${formatGbp(vendorDelta)} to you + ${formatGbp(feeExtra)} Eventtz fee (${feePct}%).`;
  }

  if (vendorDelta < 0 && deltaGbp < 0) {
    const feeReduction = Math.round((Math.abs(vendorDelta) - Math.abs(deltaGbp)) * 100) / 100;
    if (feeReduction <= 0) return null;
    return `${deltaLabel} for them: ${formatGbp(Math.abs(vendorDelta))} off your quote − ${formatGbp(feeReduction)} less Eventtz fee.`;
  }

  return null;
}

export function adjustmentLineKey(row: Pick<AdjustmentDraftRow, "kind" | "tag">): string {
  return `${row.kind}:${row.tag}`;
}

export function draftRowForAdjustmentKind(lines: AdjustmentDraftRow[], kind: AdjustmentKind): AdjustmentDraftRow | undefined {
  const tag = kind === "discount" ? "discount" : "other";
  return lines.find((l) => l.kind === kind && l.tag === tag);
}

export function applyDraftLine(
  lines: AdjustmentDraftRow[],
  kind: AdjustmentKind,
  rawAmount: string,
  reason: string,
): AdjustmentDraftRow[] {
  const tag = kind === "discount" ? "discount" : "other";
  const without = lines.filter((l) => adjustmentLineKey(l) !== `${kind}:${tag}`);
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

export function adjustmentKindFromRow(row: AdjustmentDraftRow): AdjustmentKind {
  return row.kind === "discount" ? "discount" : "cost";
}

export function legacyLabelToReason(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "Delivery or travel" || trimmed === "Other" || trimmed === "Additional cost") {
    return "";
  }
  return trimmed;
}

export function draftsFromDetail(detail: VendorBookingDetail): AdjustmentDraftRow[] {
  return detail.vendor_adjustments.map((a) => ({
    kind: a.amount_gbp < 0 ? "discount" : "cost",
    tag: a.adjustment_category || "other",
    label: a.label,
    amount: String(Math.abs(a.amount_gbp)),
  }));
}

export function hasSavedPriceUpdate(detail: VendorBookingDetail): boolean {
  return detail.vendor_adjustments.length > 0;
}

export function formatLineSummary(row: AdjustmentDraftRow): string {
  const amount = formatGbp(Number.parseFloat(row.amount));
  if (row.kind === "discount") return `Discount −${amount}`;
  return `${row.label || "Extra charge"} +${amount}`;
}

export function costNeedsReason(lines: AdjustmentDraftRow[]): boolean {
  return lines.some((row) => row.kind === "cost" && row.amount.trim() && !row.label.trim());
}
