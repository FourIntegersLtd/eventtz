import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";

export type AdjDraftRow = {
  kind: "cost" | "discount";
  tag: string;
  label: string;
  amount: string;
};

export type AdjKind = "cost" | "discount";

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

export function previewClientTotalLabel(
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

export function lineKey(row: Pick<AdjDraftRow, "kind" | "tag">): string {
  return `${row.kind}:${row.tag}`;
}

export function rowForKind(lines: AdjDraftRow[], kind: AdjKind): AdjDraftRow | undefined {
  const tag = kind === "discount" ? "discount" : "other";
  return lines.find((l) => l.kind === kind && l.tag === tag);
}

export function applyDraftLine(
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

export function kindFromRow(row: AdjDraftRow): AdjKind {
  return row.kind === "discount" ? "discount" : "cost";
}

export function legacyLabelToReason(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "Delivery or travel" || trimmed === "Other" || trimmed === "Additional cost") {
    return "";
  }
  return trimmed;
}

export function draftsFromDetail(detail: VendorBookingDetail): AdjDraftRow[] {
  return detail.vendor_adjustments.map((a) => ({
    kind: a.amount_gbp < 0 ? "discount" : "cost",
    tag: a.tag || "other",
    label: a.label,
    amount: String(Math.abs(a.amount_gbp)),
  }));
}

export function hasSavedPriceUpdate(detail: VendorBookingDetail): boolean {
  return detail.vendor_adjustments.length > 0;
}

export function formatLineSummary(row: AdjDraftRow): string {
  const amount = formatGbp(Number.parseFloat(row.amount));
  if (row.kind === "discount") return `Discount −${amount}`;
  return `${row.label || "Extra charge"} +${amount}`;
}

export function costNeedsReason(lines: AdjDraftRow[]): boolean {
  return lines.some((row) => row.kind === "cost" && row.amount.trim() && !row.label.trim());
}
