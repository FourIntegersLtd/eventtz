/**
 * Turns an onboarding payload into the packages, rates, and shared travel lines
 * shown on the vendor profile. Display only.
 */
import { displayServicesOffered } from "./browseLabels";
import {
  defaultMinQuantity,
  isPerUnitPricing,
  parsePackagePricingMode,
  parsePackageQuantity,
  perUnitPriceSuffix,
  type PackagePricingMode,
} from "./packagePricing";
import {
  buildDiscountPromoLines,
  listPriceDisplay,
  parseSingleMoneyNumber,
  parseVendorDiscountConfig,
  type VendorDiscountConfig,
} from "./vendorDiscountDisplay";
import type { BrowsePricingOption, BrowsePricingSharedContext } from "./vendorBrowseDetailModel";

function coerceStr(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

type RawPackage = {
  id: string;
  title: string;
  details: string;
  price: string;
  duration: string;
  useDefaultTravelPackage: boolean;
  pricingMode: PackagePricingMode;
  unitLabel: string;
  minQuantity: string;
  maxQuantity: string;
};

const TRAVEL_POLICY_LABELS: Record<string, string> = {
  fee_included: "Travel or delivery fee is included",
  free_within_base_city: "Free within their base city (extra may apply outside)",
  fee_after_booking_request: "Travel or delivery fee confirmed after you enquire",
  not_applicable: "Travel or delivery not needed for this service",
};

function packageTravelLine(payload: Record<string, unknown>, useDefaultTravelPackage: boolean): string | null {
  if (!useDefaultTravelPackage) return "Custom travel or delivery terms for this package";
  const policyRaw = coerceStr(payload, "travelDeliveryPolicy");
  if (policyRaw === "custom") {
    const custom = coerceStr(payload, "travelDeliveryPolicyCustomText");
    return custom || "Custom travel or delivery terms";
  }
  if (!policyRaw) return null;
  return TRAVEL_POLICY_LABELS[policyRaw] ?? null;
}

function normalizePackages(payload: Record<string, unknown>): RawPackage[] {
  const raw = payload.packages;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const record = item as Record<string, unknown>;
    const id = coerceStr(record, "id").trim();
    return {
      id: id || `package-${index}`,
      title: coerceStr(record, "title").trim(),
      details: coerceStr(record, "details").trim(),
      price: coerceStr(record, "price").trim(),
      duration: coerceStr(record, "duration").trim(),
      useDefaultTravelPackage: record.useDefaultTravelPackage !== false,
      pricingMode: parsePackagePricingMode(record.pricingMode),
      unitLabel: coerceStr(record, "unitLabel").trim(),
      minQuantity: coerceStr(record, "minQuantity").trim(),
      maxQuantity: coerceStr(record, "maxQuantity").trim(),
    };
  });
}

/** A package counts only when it has a name and one valid price (and a unit label if per-unit). */
function isCompletePackage(pkg: RawPackage): boolean {
  if (!pkg.title || parseSingleMoneyNumber(pkg.price) === null) return false;
  if (isPerUnitPricing(pkg.pricingMode) && !pkg.unitLabel) return false;
  return true;
}

function tabLabelFromTitle(title: string, fallback: string): string {
  const trimmed = title.trim();
  if (!trimmed) return fallback;
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 17)}…`;
}

function servicesFeatureLines(payload: Record<string, unknown>): string[] {
  const services = Array.isArray(payload.servicesOffered)
    ? payload.servicesOffered.map((service) => String(service).trim()).filter(Boolean)
    : [];
  return displayServicesOffered(services).slice(0, 6);
}

/** Travel, services, and promos collected once in onboarding, shown above the packages. */
export function extractBrowsePricingSharedContext(
  payload: Record<string, unknown>,
  options: BrowsePricingOption[],
): BrowsePricingSharedContext {
  const defaultTravel = packageTravelLine(payload, true);
  const travelLines = [...new Set(options.map((option) => option.travelLine).filter(Boolean))];
  const travelLine = travelLines.length === 1 ? travelLines[0]! : defaultTravel;
  return {
    travelLine: travelLine ?? defaultTravel,
    serviceLines: servicesFeatureLines(payload),
    promoLines: options[0]?.promoLines ?? [],
  };
}

/** Per-package travel when it differs from the vendor default already shown above the list. */
export function packageSpecificTravelLine(
  option: BrowsePricingOption,
  shared: BrowsePricingSharedContext,
): string | null {
  if (!option.travelLine) return null;
  if (shared.travelLine && option.travelLine === shared.travelLine) return null;
  return option.travelLine;
}

type VendorWithPayload = {
  profile_form_data?: Record<string, unknown> | null;
};

/**
 * Completed packages first. If none are complete, hourly and daily rates.
 * If those are missing too, a single "request a quote" option.
 */
export function buildBrowsePricingOptions(vendor: VendorWithPayload): BrowsePricingOption[] {
  const payload = vendor.profile_form_data ?? {};
  const hourly = parseSingleMoneyNumber(coerceStr(payload, "hourlyRate"));
  const daily = parseSingleMoneyNumber(coerceStr(payload, "dailyRate"));
  const discountConfig = parseVendorDiscountConfig(payload);
  const promoLines = buildDiscountPromoLines(discountConfig);
  const serviceLines = servicesFeatureLines(payload);
  const completePackages = normalizePackages(payload).filter(isCompletePackage);

  if (completePackages.length > 0) {
    return completePackages.map((pkg, index) => {
      const listPrice = parseSingleMoneyNumber(pkg.price);
      const priced = listPriceDisplay(listPrice, discountConfig);
      const perUnit = isPerUnitPricing(pkg.pricingMode);
      return {
        id: pkg.id,
        tabLabel: tabLabelFromTitle(pkg.title, `Package ${index + 1}`),
        heading: pkg.title,
        priceDisplay: priced.priceDisplay,
        compareAtDisplay: priced.compareAtDisplay,
        unitPriceGbp: priced.unitPriceGbp,
        pricingMode: pkg.pricingMode,
        unitLabel: perUnit ? pkg.unitLabel || null : null,
        minQuantity: defaultMinQuantity(pkg.minQuantity),
        maxQuantity: parsePackageQuantity(pkg.maxQuantity),
        priceSuffix: perUnit ? perUnitPriceSuffix(pkg.unitLabel) : null,
        discountBadge: priced.discountBadge,
        travelLine: packageTravelLine(payload, pkg.useDefaultTravelPackage),
        promoLines,
        description: pkg.details.trim() || "Ask the vendor what's included.",
        timelineLine: pkg.duration.trim() ? pkg.duration.trim() : null,
        featureLines: serviceLines,
      };
    });
  }

  const options: BrowsePricingOption[] = [];
  if (hourly != null) {
    options.push(fixedRateOption("fixed-hourly", "Hourly", "Hourly rate", hourly, discountConfig, promoLines, serviceLines, packageTravelLine(payload, payload.useDefaultTravelHourly !== false), "Hourly rate. Confirm hours and travel with the vendor."));
  }
  if (daily != null) {
    options.push(fixedRateOption("fixed-daily", "Daily", "Daily rate", daily, discountConfig, promoLines, serviceLines, packageTravelLine(payload, payload.useDefaultTravelDaily !== false), "Daily rate. Confirm coverage and travel with the vendor."));
  }
  if (options.length > 0) return options;

  return [
    {
      id: "quote",
      tabLabel: "Quote",
      heading: "Request a quote",
      priceDisplay: null,
      compareAtDisplay: null,
      unitPriceGbp: null,
      pricingMode: "fixed",
      unitLabel: null,
      minQuantity: 1,
      maxQuantity: null,
      priceSuffix: null,
      discountBadge: null,
      travelLine: null,
      promoLines: [],
      description: "Prices aren't listed yet. Ask for a quote.",
      timelineLine: null,
      featureLines: serviceLines,
    },
  ];
}

/** A fixed hourly or daily rate card. */
function fixedRateOption(
  id: string,
  tabLabel: string,
  heading: string,
  amount: number,
  discountConfig: VendorDiscountConfig,
  promoLines: string[],
  serviceLines: string[],
  travelLine: string | null,
  description: string,
): BrowsePricingOption {
  const priced = listPriceDisplay(amount, discountConfig);
  return {
    id,
    tabLabel,
    heading,
    priceDisplay: priced.priceDisplay,
    compareAtDisplay: priced.compareAtDisplay,
    unitPriceGbp: priced.unitPriceGbp,
    pricingMode: "fixed",
    unitLabel: null,
    minQuantity: 1,
    maxQuantity: null,
    priceSuffix: null,
    discountBadge: priced.discountBadge,
    travelLine,
    promoLines,
    description,
    timelineLine: null,
    featureLines: serviceLines,
  };
}
