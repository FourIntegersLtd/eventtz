export type TravelRadius =
  | "under_50"
  | "from_50_to_100"
  | "from_100_to_200"
  | "over_200";

export type DeliveryMode =
  | "travel_to_client"
  | "client_comes"
  | "ship_to_client";

/** Step 3: default travel / delivery policy (single choice). */
export type TravelDeliveryPolicy =
  | "fee_included"
  | "free_within_base_city"
  | "fee_after_booking_request"
  | "not_applicable"
  | "custom";

export type VendorPackageItem = {
  id: string;
  title: string;
  details: string;
  price: string;
  duration: string;
  /** Apply the same default travel / delivery rule as Step 3 for this package. */
  useDefaultTravelPackage: boolean;
};

export function createVendorPackage(): VendorPackageItem {
  return {
    id:
      typeof globalThis.crypto !== "undefined" &&
      "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `pkg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    title: "",
    details: "",
    price: "",
    duration: "",
    useDefaultTravelPackage: true,
  };
}

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "website"
  | "other";

export type VendorSocialLink = {
  id: string;
  platform: SocialPlatform;
  /** Handle (e.g. "@business") or URL, depending on platform. */
  handle: string;
};

export function createVendorSocialLink(
  platform: SocialPlatform = "instagram",
): VendorSocialLink {
  return {
    id:
      typeof globalThis.crypto !== "undefined" &&
      "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `soc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    platform,
    handle: "",
  };
}

export interface VendorOnboardingData {
  // Step 1
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  // Step 2
  businessName: string;
  servicesOffered: string[];
  eventTypes: string[];
  // Step 3
  countryCode: string;
  baseCity: string;
  region: string;
  postalCode: string;
  deliveryModes: DeliveryMode[];
  travelRadius: TravelRadius | "";
  travelDeliveryPolicy: TravelDeliveryPolicy | "";
  travelDeliveryPolicyCustomText: string;
  // Step 4
  hourlyRate: string;
  dailyRate: string;
  useDefaultTravelHourly: boolean;
  useDefaultTravelDaily: boolean;
  packages: VendorPackageItem[];
  allowQuoteRequests: boolean;
  offerDiscounts: boolean;
  discountPercentage: string;
  /** Shown to clients next to the discounted price (e.g. Easter sale). */
  discountLabel: string;
  bulkDiscountThreshold: string;
  bulkDiscountPercent: string;
  offPeakDiscountPercent: string;
  // Step 5
  availableWeekdays: number[];
  blockedDates: string[];
  maxBookingsPerDay: string;
  // Step 6 — File objects are client-only; portfolioFileNamesPersisted comes from API after save
  portfolioFiles: File[];
  /** Filenames last saved to the server (File objects cannot be restored from JSON). */
  portfolioFileNamesPersisted: string[];
  portfolioVideo: File | null;
  /** Path last saved to the server for the portfolio video. */
  portfolioVideoNamePersisted: string;
  socialLinks: VendorSocialLink[];
  portfolioWarnings: string[];
  // Step 7
  stripeConnectStarted: boolean;
  // Step 8 — Additional info (optional certifications / dietary disclosures)
  foodHygieneCertFile: File | null;
  foodHygieneCertNamePersisted: string;
  indemnityCertFile: File | null;
  indemnityCertNamePersisted: string;
  otherDocsFiles: File[];
  otherDocsNamesPersisted: string[];
  isHalal: boolean;
  allergenInfo: string;
  // Step 9
  aiBioDraft: string;
  /** Public profile / cover photo — shown first on marketplace listings. */
  profileImageUrl: string;
  confirmTruthful: boolean;
  confirmTerms: boolean;
}

export type VendorOnboardingUpdate = (
  patch: Partial<VendorOnboardingData>,
) => void;

export const initialVendorOnboardingData: VendorOnboardingData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  businessName: "",
  servicesOffered: [],
  eventTypes: [],
  countryCode: "GB",
  baseCity: "",
  region: "",
  postalCode: "",
  deliveryModes: [],
  travelRadius: "",
  travelDeliveryPolicy: "fee_included",
  travelDeliveryPolicyCustomText: "",
  hourlyRate: "",
  dailyRate: "",
  useDefaultTravelHourly: true,
  useDefaultTravelDaily: true,
  packages: [
    {
      id: "pkg-1",
      title: "",
      details: "",
      price: "",
      duration: "",
      useDefaultTravelPackage: true,
    },
  ],
  allowQuoteRequests: true,
  offerDiscounts: false,
  discountPercentage: "",
  discountLabel: "",
  bulkDiscountThreshold: "",
  bulkDiscountPercent: "",
  offPeakDiscountPercent: "",
  availableWeekdays: [],
  blockedDates: [],
  maxBookingsPerDay: "1",
  portfolioFiles: [],
  portfolioFileNamesPersisted: [],
  portfolioVideo: null,
  portfolioVideoNamePersisted: "",
  socialLinks: [],
  portfolioWarnings: [],
  stripeConnectStarted: false,
  foodHygieneCertFile: null,
  foodHygieneCertNamePersisted: "",
  indemnityCertFile: null,
  indemnityCertNamePersisted: "",
  otherDocsFiles: [],
  otherDocsNamesPersisted: [],
  isHalal: false,
  allergenInfo: "",
  aiBioDraft: "",
  profileImageUrl: "",
  confirmTruthful: false,
  confirmTerms: false,
};
