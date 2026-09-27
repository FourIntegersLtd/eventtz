/**
 * Vendor discount parsing and client-facing price labels.
 * Ported from the baseline `vendorDiscountDisplay.ts`.
 * Also holds the strict single-amount parser the baseline kept in `validation/money.ts`,
 * because package prices on this page have to reject ranges.
 */

/** Onboarding bounds for one fixed GBP amount. */
const MIN_MONEY_GBP = 0.1;
const MAX_MONEY_GBP = 1_000_000;

const MULTIPLE_AMOUNT_SEPARATOR_RE = /[,;/|]/;

const AMBIGUOUS_PRICE_RE =
  /\b(starts?\s+from|from\s+£|from\s+\d|price\s+on\s+request|\bpoa\b|\btbc\b|£?\s*\d+(?:\.\d+)?\s*[-–—]\s*£?\s*\d+|\d+\s+(?:and|or)\s+\d+)/i;

const SINGLE_GBP_AMOUNT_RE = /^(?:£|gbp\s*)?\s*(\d+(?:\.\d{1,2})?)\s*$/i;

/** Error text when `raw` is not one fixed GBP amount, or null when it is valid or empty. */
function validateSingleMoneyAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (MULTIPLE_AMOUNT_SEPARATOR_RE.test(trimmed)) {
    return "Amount must be one amount only — add a separate package for each price.";
  }
  if (AMBIGUOUS_PRICE_RE.test(trimmed)) {
    return "Amount must be one fixed amount, not a range or “starts from” price.";
  }
  const match = trimmed.match(SINGLE_GBP_AMOUNT_RE);
  if (!match) return "Amount must be a single number (e.g. 150 or 150.00).";
  const amount = Number.parseFloat(match[1]!);
  if (!Number.isFinite(amount)) return "Amount must be a valid amount";
  if (amount < MIN_MONEY_GBP) return `Amount must be at least £${MIN_MONEY_GBP.toFixed(2)}`;
  if (amount > MAX_MONEY_GBP) return "Amount is out of allowed range";
  return null;
}

/** One strictly validated GBP amount, or null when the text is empty, a range, or out of range. */
export function parseSingleMoneyNumber(raw: string): number | null {
  if (validateSingleMoneyAmount(raw)) return null;
  const match = raw.trim().match(SINGLE_GBP_AMOUNT_RE);
  if (!match) return null;
  return Number.parseFloat(match[1]!);
}

function coerceStr(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** Loose money parse for discount percents (strips currency symbols). */
export function parseMoneyNumber(raw: string): number | null {
  const digits = raw.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const amount = Number.parseFloat(digits);
  return Number.isFinite(amount) ? amount : null;
}

/** Pounds for a label, without a currency sign. Whole pounds omit decimals. */
export function formatGbp(amount: number): string {
  return amount.toLocaleString("en-GB", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export type VendorDiscountConfig = {
  offerDiscounts: boolean;
  /** Main listing discount, applied to the prices shown on the profile. */
  discountPct: number;
  discountLabel: string;
  bulkThreshold: number | null;
  bulkPct: number | null;
  offPeakPct: number | null;
};

/** Read the vendor's discount fields from the onboarding payload. */
export function parseVendorDiscountConfig(payload: Record<string, unknown>): VendorDiscountConfig {
  return {
    offerDiscounts: payload.offerDiscounts === true,
    discountPct: parseMoneyNumber(coerceStr(payload, "discountPercentage")) ?? 0,
    discountLabel: coerceStr(payload, "discountLabel").trim(),
    bulkThreshold: parseSingleMoneyNumber(coerceStr(payload, "bulkDiscountThreshold")),
    bulkPct: parseMoneyNumber(coerceStr(payload, "bulkDiscountPercent")),
    offPeakPct: parseMoneyNumber(coerceStr(payload, "offPeakDiscountPercent")),
  };
}

/** List price after a percentage discount. Out-of-range percents leave the list price. */
export function salePriceAfterDiscount(listPrice: number, percent: number): number {
  if (percent <= 0 || percent >= 100) return listPrice;
  return listPrice * (1 - percent / 100);
}

/** True when the main listing discount should change the shown price. */
export function hasActiveListDiscount(config: VendorDiscountConfig): boolean {
  return config.offerDiscounts && config.discountPct > 0 && config.discountPct < 100;
}

function formatDiscountPercent(percent: number): string {
  const rounded = Math.round(percent * 100) / 100;
  return `${rounded % 1 === 0 ? rounded : rounded}%`;
}

/** Badge for the main listing discount, or null when it is not active. */
export function buildPrimaryDiscountBadge(config: VendorDiscountConfig): string | null {
  if (!hasActiveListDiscount(config)) return null;
  const percentLabel = `${formatDiscountPercent(config.discountPct)} off`;
  if (config.discountLabel) return `${percentLabel} - ${config.discountLabel}`;
  return percentLabel;
}

/** Bulk and off-peak lines. They are applied at booking when the request qualifies. */
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
      `${formatDiscountPercent(config.offPeakPct)} off off-peak dates (Nov-Feb, applied automatically if eligible)`,
    );
  }
  return lines;
}

const AUTO_BULK_LINE_ID = "auto-bulk";
const AUTO_OFF_PEAK_LINE_ID = "auto-off-peak";

/** Platform off-peak window: November through February. */
export function isOffPeakDate(isoDate: string): boolean {
  const head = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return false;
  const month = Number.parseInt(head.slice(5, 7), 10);
  return month === 11 || month === 12 || month === 1 || month === 2;
}

export type BookingEstimateLine = {
  id: string;
  heading: string;
  unitPriceGbp: number | null;
};

/**
 * Stack discounts the way the server does: the main discount is already in the
 * line prices, then bulk, then off-peak.
 */
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

  const autoSum = autoLines.reduce((total, line) => total + (line.unitPriceGbp ?? 0), 0);
  return { sumNumeric: Math.round((sum + autoSum) * 100) / 100, hasTbc: false, autoLines };
}

/** "GBP 120", "GBP 13.70", or "TBC" when a selected line has no price. */
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

/** Shown price, optional crossed-out list price, and the amount used in estimates. */
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
