import { clampBioWords } from "./onboardingLogic";
import type {
  DeliveryMode,
  SocialPlatform,
  VendorOnboardingData,
  VendorPackageItem,
  VendorSocialLink,
} from "./types";
import { createVendorPackage, createVendorSocialLink, initialVendorOnboardingData } from "./types";

/** JSONB may arrive as object or (rarely) string; numbers may appear instead of string fields. */
export function normalizeVendorPayload(
  raw: unknown,
): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function coerceStr(p: Record<string, unknown>, k: string): string {
  const v = p[k];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

const DELIVERY_SET = new Set<string>([
  "travel_to_client",
  "client_comes",
  "ship_to_client",
]);

function parseDeliveryModes(raw: unknown): DeliveryMode[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is DeliveryMode =>
      typeof x === "string" && DELIVERY_SET.has(x),
  );
}

const SOCIAL_PLATFORM_SET = new Set<string>([
  "instagram",
  "tiktok",
  "facebook",
  "website",
  "other",
]);

function parseSocialLinks(raw: unknown): VendorSocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((rp) => {
      const o = rp as Record<string, unknown>;
      const platform = typeof o.platform === "string" && SOCIAL_PLATFORM_SET.has(o.platform)
        ? (o.platform as SocialPlatform)
        : "other";
      return {
        id: typeof o.id === "string" && o.id ? o.id : createVendorSocialLink().id,
        platform,
        handle: coerceStr(o, "handle"),
      };
    })
    .filter((s) => s.handle.trim());
}

/** Migrates legacy fixed instagram/tiktok/website URL fields into `socialLinks`. */
function migrateLegacySocialFields(p: Record<string, unknown>): VendorSocialLink[] {
  const links: VendorSocialLink[] = [];
  const instagram = coerceStr(p, "instagramUrl");
  const tiktok = coerceStr(p, "tiktokUrl");
  const website = coerceStr(p, "websiteUrl");
  if (instagram.trim()) links.push({ ...createVendorSocialLink("instagram"), handle: instagram });
  if (tiktok.trim()) links.push({ ...createVendorSocialLink("tiktok"), handle: tiktok });
  if (website.trim()) links.push({ ...createVendorSocialLink("website"), handle: website });
  return links;
}

export function vendorDataToPayload(
  data: VendorOnboardingData,
): Record<string, unknown> {
  const names = new Set<string>();
  for (const n of data.portfolioFileNamesPersisted) {
    const u = n.trim();
    if (/^https?:\/\//i.test(u)) names.add(u);
  }

  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    businessName: data.businessName,
    servicesOffered: data.servicesOffered,
    eventTypes: data.eventTypes,
    baseCity: data.baseCity,
    deliveryModes: data.deliveryModes,
    travelRadius: data.travelRadius,
    travelDeliveryPolicy: data.travelDeliveryPolicy,
    travelDeliveryPolicyCustomText: data.travelDeliveryPolicyCustomText,
    hourlyRate: data.hourlyRate,
    dailyRate: data.dailyRate,
    useDefaultTravelHourly: data.useDefaultTravelHourly,
    useDefaultTravelDaily: data.useDefaultTravelDaily,
    packages: data.packages.map((p) => ({
      id: p.id,
      title: p.title,
      details: p.details,
      price: p.price,
      duration: p.duration,
      useDefaultTravelPackage: p.useDefaultTravelPackage,
    })),
    allowQuoteRequests: data.allowQuoteRequests,
    offerDiscounts: data.offerDiscounts,
    discountPercentage: data.discountPercentage,
    bulkDiscountThreshold: data.bulkDiscountThreshold,
    bulkDiscountPercent: data.bulkDiscountPercent,
    offPeakDiscountPercent: data.offPeakDiscountPercent,
    availableWeekdays: data.availableWeekdays,
    blockedDates: data.blockedDates,
    maxBookingsPerDay: data.maxBookingsPerDay,
    portfolioFileNames: [...names],
    portfolioVideoNamePersisted: data.portfolioVideoNamePersisted,
    socialLinks: data.socialLinks.map((s) => ({
      id: s.id,
      platform: s.platform,
      handle: s.handle,
    })),
    portfolioWarnings: data.portfolioWarnings,
    stripeConnectStarted: data.stripeConnectStarted,
    foodHygieneCertNamePersisted: data.foodHygieneCertNamePersisted,
    indemnityCertNamePersisted: data.indemnityCertNamePersisted,
    otherDocsNamesPersisted: data.otherDocsNamesPersisted,
    isHalal: data.isHalal,
    allergenInfo: data.allergenInfo,
    aiBioDraft: clampBioWords(data.aiBioDraft),
    confirmTruthful: data.confirmTruthful,
    confirmTerms: data.confirmTerms,
  };
}

export function mergePayloadIntoVendorData(
  payload: Record<string, unknown> | undefined,
  userEmail: string,
): Partial<VendorOnboardingData> {
  if (!payload || typeof payload !== "object") return {};
  const p = payload;

  const strArr = (k: string): string[] =>
    Array.isArray(p[k]) ? (p[k] as unknown[]).map(String) : [];
  const numArr = (k: string): number[] =>
    Array.isArray(p[k])
      ? (p[k] as unknown[])
          .map((n) => Number(n))
          .filter((n) => !Number.isNaN(n))
      : [];

  const rawPackages = p.packages;
  let packages: VendorPackageItem[] = initialVendorOnboardingData.packages;
  if (Array.isArray(rawPackages) && rawPackages.length > 0) {
    packages = rawPackages.map((rp) => {
      const o = rp as Record<string, unknown>;
      return {
        id:
          typeof o.id === "string" && o.id
            ? o.id
            : createVendorPackage().id,
        title: coerceStr(o, "title"),
        details: coerceStr(o, "details"),
        price: coerceStr(o, "price"),
        duration: coerceStr(o, "duration"),
        useDefaultTravelPackage:
          typeof o.useDefaultTravelPackage === "boolean"
            ? o.useDefaultTravelPackage
            : true,
      };
    });
  }

  const portfolioFileNamesPersisted = strArr("portfolioFileNames");

  const tr = coerceStr(p, "travelRadius");
  const tdp = coerceStr(p, "travelDeliveryPolicy");

  const socialLinks = Array.isArray(p.socialLinks)
    ? parseSocialLinks(p.socialLinks)
    : migrateLegacySocialFields(p);

  return {
    firstName: coerceStr(p, "firstName"),
    lastName: coerceStr(p, "lastName"),
    email: coerceStr(p, "email") || userEmail,
    phone: coerceStr(p, "phone"),
    businessName: coerceStr(p, "businessName"),
    servicesOffered: strArr("servicesOffered"),
    eventTypes: strArr("eventTypes"),
    baseCity: coerceStr(p, "baseCity"),
    deliveryModes: parseDeliveryModes(p.deliveryModes),
    travelRadius: (tr as VendorOnboardingData["travelRadius"]) || "",
    travelDeliveryPolicy:
      (tdp as VendorOnboardingData["travelDeliveryPolicy"]) || "fee_included",
    travelDeliveryPolicyCustomText: coerceStr(p, "travelDeliveryPolicyCustomText"),
    hourlyRate: coerceStr(p, "hourlyRate"),
    dailyRate: coerceStr(p, "dailyRate"),
    useDefaultTravelHourly:
      typeof p.useDefaultTravelHourly === "boolean"
        ? p.useDefaultTravelHourly
        : true,
    useDefaultTravelDaily:
      typeof p.useDefaultTravelDaily === "boolean"
        ? p.useDefaultTravelDaily
        : true,
    packages,
    allowQuoteRequests:
      typeof p.allowQuoteRequests === "boolean" ? p.allowQuoteRequests : true,
    offerDiscounts:
      typeof p.offerDiscounts === "boolean" ? p.offerDiscounts : false,
    discountPercentage: coerceStr(p, "discountPercentage"),
    bulkDiscountThreshold: coerceStr(p, "bulkDiscountThreshold"),
    bulkDiscountPercent: coerceStr(p, "bulkDiscountPercent"),
    offPeakDiscountPercent: coerceStr(p, "offPeakDiscountPercent"),
    availableWeekdays: numArr("availableWeekdays"),
    blockedDates: strArr("blockedDates"),
    maxBookingsPerDay: coerceStr(p, "maxBookingsPerDay") || "1",
    portfolioFiles: [],
    portfolioFileNamesPersisted,
    portfolioVideo: null,
    portfolioVideoNamePersisted: coerceStr(p, "portfolioVideoNamePersisted"),
    socialLinks,
    portfolioWarnings: strArr("portfolioWarnings"),
    stripeConnectStarted:
      typeof p.stripeConnectStarted === "boolean"
        ? p.stripeConnectStarted
        : false,
    foodHygieneCertFile: null,
    foodHygieneCertNamePersisted: coerceStr(p, "foodHygieneCertNamePersisted"),
    indemnityCertFile: null,
    indemnityCertNamePersisted: coerceStr(p, "indemnityCertNamePersisted"),
    otherDocsFiles: [],
    otherDocsNamesPersisted: strArr("otherDocsNamesPersisted"),
    isHalal: typeof p.isHalal === "boolean" ? p.isHalal : false,
    allergenInfo: coerceStr(p, "allergenInfo"),
    aiBioDraft: coerceStr(p, "aiBioDraft"),
    confirmTruthful:
      typeof p.confirmTruthful === "boolean" ? p.confirmTruthful : false,
    confirmTerms: typeof p.confirmTerms === "boolean" ? p.confirmTerms : false,
    password: "",
  };
}
