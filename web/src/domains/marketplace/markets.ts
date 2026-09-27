/**
 * Supported marketplace countries — ported from the baseline `markets.ts`.
 * Currently only GB is enabled.
 */

export type DistanceUnit = "mi" | "km";

export type MarketConfig = {
  countryCode: string;
  currency: string;
  distanceUnit: DistanceUnit;
  stripeConnectCountry: string;
  label: string;
  enabled: boolean;
  default: boolean;
};

export const DEFAULT_COUNTRY_CODE = "GB";
export const DEFAULT_CURRENCY = "GBP";

export const MARKETS: Record<string, MarketConfig> = {
  GB: {
    countryCode: "GB",
    currency: "GBP",
    distanceUnit: "mi",
    stripeConnectCountry: "GB",
    label: "United Kingdom",
    enabled: true,
    default: true,
  },
};

/** Normalise a raw country code to a known market key, defaulting to GB. */
export function normalizeCountryCode(raw: string | null | undefined): string {
  const code = (raw ?? "").trim().toUpperCase();
  if (code in MARKETS) return code;
  return DEFAULT_COUNTRY_CODE;
}

/** Look up the market config for a country code. */
export function getMarket(countryCode?: string | null): MarketConfig {
  const market = MARKETS[normalizeCountryCode(countryCode)];
  if (!market) return MARKETS[DEFAULT_COUNTRY_CODE]!;
  return market;
}

/** The default market. */
export function defaultMarket(): MarketConfig {
  return Object.values(MARKETS).find((market) => market.default) ?? MARKETS[DEFAULT_COUNTRY_CODE]!;
}

/** A fallback location string (the country label) when a city is missing. */
export function marketLocationFallback(countryCode?: string | null): string {
  return getMarket(countryCode).label;
}

/** Narrow currency symbol (e.g. "£") for the given currency code. */
export function formatCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Format a monetary amount for display (major units, e.g. pounds not pence). */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Budget filter label for the active market. */
export function budgetFilterLabel(countryCode?: string | null): string {
  const market = getMarket(countryCode);
  return `Budget (${market.currency})`;
}
