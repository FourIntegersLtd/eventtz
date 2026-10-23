/**
 * The only place money and plain counts are formatted for display (guarded by
 * `lib/formatGuard.test.ts`). Fixed to `en-GB` and pounds so server and browser render the same
 * text whatever the visitor's locale. Money stays a number here: pounds for `formatGbp`, integer
 * pence for `formatPence`. Each screen picks the `decimals` rule it always used.
 */
import { DEFAULT_CURRENCY } from "./markets";

/**
 * How many decimals to show:
 * - `0`: whole pounds ("£1,235").
 * - `2`: always pence ("£1,234.50", "£12.00").
 * - `"auto"`: none for a whole amount, otherwise two ("£12", "£12.50").
 * - `"upTo2"`: as many as the amount has, up to two ("£12", "£12.5", "£12.34").
 */
export type GbpDecimals = 0 | 2 | "auto" | "upTo2";

export type FormatGbpOptions = {
  /** Decimal rule; `"auto"` when omitted. */
  decimals?: GbpDecimals;
  /** Text before the number; "£" when omitted. Use "" for a bare number or "GBP " for estimate labels. */
  prefix?: string;
  /** Thousands separators; on when omitted. Some labels never had them ("£1234.50"). */
  grouping?: boolean;
  /** Put "+" before a non-negative amount (price-change rows). */
  showPlus?: boolean;
  /** Round to whole pence first, as the booking fee labels do before formatting. */
  roundToPence?: boolean;
  /** Returned for a missing or non-numeric amount; "-" when omitted. */
  fallback?: string;
};

/** Minimum and maximum fraction digits for one amount under a decimal rule. */
function fractionDigits(decimals: GbpDecimals, absoluteAmount: number): { min: number; max: number } {
  if (decimals === 0) return { min: 0, max: 0 };
  if (decimals === 2) return { min: 2, max: 2 };
  if (decimals === "upTo2") return { min: 0, max: 2 };
  return { min: absoluteAmount % 1 === 0 ? 0 : 2, max: 2 };
}

/** Formats an amount in pounds, e.g. 1234.5 becomes "£1,234.50". A negative amount reads "-£5". */
export function formatGbp(amountGbp: number | null | undefined, options: FormatGbpOptions = {}): string {
  const {
    decimals = "auto",
    prefix = "£",
    grouping = true,
    showPlus = false,
    roundToPence = false,
    fallback = "-",
  } = options;
  if (amountGbp == null || Number.isNaN(amountGbp)) return fallback;
  const amount = roundToPence ? Math.round(amountGbp * 100) / 100 : amountGbp;
  const absoluteAmount = Math.abs(amount);
  const { min, max } = fractionDigits(decimals, absoluteAmount);
  const digits = absoluteAmount.toLocaleString("en-GB", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
    useGrouping: grouping,
  });
  const sign = amount < 0 ? "-" : showPlus ? "+" : "";
  return `${sign}${prefix}${digits}`;
}

/** Formats integer pence as pounds with two decimals, e.g. 108000 becomes "£1,080.00". */
export function formatPence(pence: number | null | undefined, options: FormatGbpOptions = {}): string {
  return formatGbp(pence == null ? pence : pence / 100, { decimals: 2, ...options });
}

/** Formats a plain count with thousands separators, e.g. 12000 becomes "12,000". */
export function formatCount(count: number): string {
  return count.toLocaleString("en-GB");
}

/** Currency symbol for a market's currency ("£", "$"); falls back to the code when unknown. */
export function formatCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Formats an amount in major units (pounds, not pence) in a market's currency, up to two decimals. */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
