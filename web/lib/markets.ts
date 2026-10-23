/** Supported marketplace countries - mirror of backend `app/features/vendors/markets.py`. */

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

export function normalizeCountryCode(raw: string | null | undefined): string {
  const code = (raw ?? "").trim().toUpperCase();
  if (code in MARKETS) return code;
  return DEFAULT_COUNTRY_CODE;
}

export function getMarket(countryCode?: string | null): MarketConfig {
  return MARKETS[normalizeCountryCode(countryCode)]!;
}

export function defaultMarket(): MarketConfig {
  return Object.values(MARKETS).find((m) => m.default) ?? MARKETS.GB!;
}

export function enabledMarkets(): MarketConfig[] {
  return Object.values(MARKETS).filter((m) => m.enabled);
}

export function marketLocationFallback(countryCode?: string | null): string {
  return getMarket(countryCode).label;
}

/** Budget filter label for the active market. */
export function budgetFilterLabel(countryCode?: string | null): string {
  const market = getMarket(countryCode);
  return `Budget (${market.currency})`;
}
