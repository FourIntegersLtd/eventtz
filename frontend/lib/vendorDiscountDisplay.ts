/** Shared vendor discount parsing and client-facing price display helpers. */

function coerceStr(p: Record<string, unknown>, k: string): string {
  const v = p[k];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export function parseMoneyNumber(raw: string): number | null {
  const s = raw.replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function formatGbp(n: number): string {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export type VendorDiscountConfig = {
  offerDiscounts: boolean;
  /** Main listing discount (applies to shown package / rate prices). */
  discountPct: number;
  discountLabel: string;
  bulkThreshold: number | null;
  bulkPct: number | null;
  offPeakPct: number | null;
};

export function parseVendorDiscountConfig(
  payload: Record<string, unknown>,
): VendorDiscountConfig {
  return {
    offerDiscounts: payload.offerDiscounts === true,
    discountPct: parseMoneyNumber(coerceStr(payload, "discountPercentage")) ?? 0,
    discountLabel: coerceStr(payload, "discountLabel").trim(),
    bulkThreshold: parseMoneyNumber(coerceStr(payload, "bulkDiscountThreshold")),
    bulkPct: parseMoneyNumber(coerceStr(payload, "bulkDiscountPercent")),
    offPeakPct: parseMoneyNumber(coerceStr(payload, "offPeakDiscountPercent")),
  };
}

/** List price → sale price after a percentage discount. */
export function salePriceAfterDiscount(listPrice: number, pct: number): number {
  if (pct <= 0 || pct >= 100) return listPrice;
  return listPrice * (1 - pct / 100);
}

export function hasActiveListDiscount(config: VendorDiscountConfig): boolean {
  return config.offerDiscounts && config.discountPct > 0 && config.discountPct < 100;
}

export function buildPrimaryDiscountBadge(config: VendorDiscountConfig): string | null {
  if (!hasActiveListDiscount(config)) return null;
  const pctLabel = `${formatDiscountPercent(config.discountPct)} off`;
  if (config.discountLabel) {
    return `${pctLabel} — ${config.discountLabel}`;
  }
  return pctLabel;
}

function formatDiscountPercent(pct: number): string {
  const rounded = Math.round(pct * 100) / 100;
  return rounded % 1 === 0 ? `${rounded}%` : `${rounded}%`;
}

/** Extra promos shown on listings (bulk / off-peak — applied at booking when eligible). */
export function buildDiscountPromoLines(config: VendorDiscountConfig): string[] {
  if (!config.offerDiscounts) return [];
  const lines: string[] = [];
  if (
    config.bulkThreshold != null &&
    config.bulkThreshold > 0 &&
    config.bulkPct != null &&
    config.bulkPct > 0
  ) {
    lines.push(
      `Extra ${formatDiscountPercent(config.bulkPct)} off bookings over GBP ${formatGbp(config.bulkThreshold)} (applied automatically if eligible)`,
    );
  }
  if (config.offPeakPct != null && config.offPeakPct > 0) {
    lines.push(
      `${formatDiscountPercent(config.offPeakPct)} off off-peak dates (Nov–Feb, applied automatically if eligible)`,
    );
  }
  return lines;
}

const AUTO_BULK_LINE_ID = "auto-bulk";
const AUTO_OFF_PEAK_LINE_ID = "auto-off-peak";

/** Platform off-peak: 1 Nov – last day of Feb (matches backend). */
export function isOffPeakDate(isoDate: string): boolean {
  const s = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const month = Number.parseInt(s.slice(5, 7), 10);
  return month === 11 || month === 12 || month === 1 || month === 2;
}

export type BookingEstimateLine = {
  id: string;
  heading: string;
  unitPriceGbp: number | null;
};

/** Mirror server stacking: main discount on lines, then bulk, then off-peak auto lines. */
export function computeBookingEstimateGbp(
  positiveLines: BookingEstimateLine[],
  vendorPayload: Record<string, unknown>,
  eventDateIso: string | null,
): { sumNumeric: number; hasTbc: boolean; autoLines: BookingEstimateLine[] } {
  let sum = 0;
  let hasTbc = false;
  for (const line of positiveLines) {
    if (line.unitPriceGbp == null) hasTbc = true;
    else sum += line.unitPriceGbp;
  }

  const autoLines: BookingEstimateLine[] = [];
  if (hasTbc || positiveLines.length === 0) {
    return { sumNumeric: sum, hasTbc, autoLines };
  }

  const config = parseVendorDiscountConfig(vendorPayload);
  if (!config.offerDiscounts) {
    return { sumNumeric: sum, hasTbc: false, autoLines };
  }

  let remaining = sum;

  if (
    config.bulkThreshold != null &&
    config.bulkThreshold > 0 &&
    config.bulkPct != null &&
    config.bulkPct > 0 &&
    sum >= config.bulkThreshold
  ) {
    const bulkReduction = Math.round(remaining * (config.bulkPct / 100) * 100) / 100;
    if (bulkReduction > 0) {
      autoLines.push({
        id: AUTO_BULK_LINE_ID,
        heading: `Bulk booking discount (${formatDiscountPercent(config.bulkPct)})`,
        unitPriceGbp: -bulkReduction,
      });
      remaining = Math.round((remaining - bulkReduction) * 100) / 100;
    }
  }

  if (
    config.offPeakPct != null &&
    config.offPeakPct > 0 &&
    eventDateIso &&
    isOffPeakDate(eventDateIso) &&
    remaining > 0
  ) {
    const offPeakReduction = Math.round(remaining * (config.offPeakPct / 100) * 100) / 100;
    if (offPeakReduction > 0) {
      autoLines.push({
        id: AUTO_OFF_PEAK_LINE_ID,
        heading: `Off-peak discount (${formatDiscountPercent(config.offPeakPct)})`,
        unitPriceGbp: -offPeakReduction,
      });
      remaining = Math.round((remaining - offPeakReduction) * 100) / 100;
    }
  }

  const autoSum = autoLines.reduce((acc, l) => acc + (l.unitPriceGbp ?? 0), 0);
  return { sumNumeric: Math.round((sum + autoSum) * 100) / 100, hasTbc: false, autoLines };
}

export function formatBookingEstimateLabel(sumNumeric: number, hasTbc: boolean): string {
  const formatted = sumNumeric.toLocaleString("en-GB", {
    minimumFractionDigits: sumNumeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (hasTbc) {
    return sumNumeric > 0 ? `GBP ${formatted} + TBC` : "TBC";
  }
  return `GBP ${formatted}`;
}

export type ListPriceDisplay = {
  /** Sale price shown prominently (after main discount, if any). */
  priceDisplay: string;
  /** Original list price — show crossed out when a main discount applies. */
  compareAtDisplay: string | null;
  /** Amount used for booking estimates. */
  unitPriceGbp: number;
  discountBadge: string | null;
};

export function listPriceDisplay(
  listPrice: number | null,
  config: VendorDiscountConfig,
): {
  priceDisplay: string | null;
  compareAtDisplay: string | null;
  unitPriceGbp: number | null;
  discountBadge: string | null;
} {
  if (listPrice == null) {
    return {
      priceDisplay: null,
      compareAtDisplay: null,
      unitPriceGbp: null,
      discountBadge: null,
    };
  }

  const badge = buildPrimaryDiscountBadge(config);

  if (hasActiveListDiscount(config)) {
    const sale = salePriceAfterDiscount(listPrice, config.discountPct);
    return {
      priceDisplay: formatGbp(sale),
      compareAtDisplay: formatGbp(listPrice),
      unitPriceGbp: sale,
      discountBadge: badge,
    };
  }

  return {
    priceDisplay: formatGbp(listPrice),
    compareAtDisplay: null,
    unitPriceGbp: listPrice,
    discountBadge: null,
  };
}
