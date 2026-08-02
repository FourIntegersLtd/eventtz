import { SOCIAL_PLATFORM_OPTIONS, WEEKDAY_LABELS } from "@/features/vendor/onboarding/constants";
import {
  formatDiscountSummary,
  formatReviewBlockedDates,
  formatReviewEventTypes,
  formatReviewServices,
  hasAdditionalInfoContent,
  packageTravelPolicyLabel,
} from "@/features/vendor/onboarding/reviewDisplayHelpers";
import type { VendorOnboardingData } from "@/features/vendor/onboarding/types";
import { getMarket } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
import { portfolioImageUrlsFromPayload } from "@/lib/vendorPortfolioImages";
import {
  buildSubmittedMediaBundle,
  type SubmittedMediaBundle,
} from "@/lib/submittedMediaUtils";
import {
  buildBrowsePricingOptions,
  extractBrowsePricingSharedContext,
  type BrowsePricingOption,
  type BrowsePricingSharedContext,
} from "@/features/client/browse/vendorBrowseDetailModel";
import { vendorDataToPayload } from "@/features/vendor/onboarding/serializeVendorPayload";

export type AdminSubmissionField = {
  label: string;
  value: string;
  missing?: boolean;
};

export type AdminSubmissionPackage = {
  title: string;
  price: string;
  duration: string;
  details: string;
  travel: string;
};

export type AdminSubmissionConfirmation = {
  label: string;
  accepted: boolean;
};

export type AdminSubmissionChecklistStatus = "pass" | "warn" | "info";

export type AdminSubmissionChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: AdminSubmissionChecklistStatus;
};

export type AdminSubmissionChecklistGroup = {
  id: string;
  title: string;
  items: AdminSubmissionChecklistItem[];
};

export type AdminVendorSubmissionReviewModel = {
  profileImageUrl: string | null;
  initials: string;
  fullName: string;
  businessName: string;
  bio: string;
  bioMissing: boolean;
  serviceLabels: string[];
  eventTypeLabels: string[];
  reachFields: AdminSubmissionField[];
  locationFields: AdminSubmissionField[];
  pricingFields: AdminSubmissionField[];
  pricingOptions: BrowsePricingOption[];
  pricingSharedContext: BrowsePricingSharedContext;
  discountLines: string[];
  availabilityFields: AdminSubmissionField[];
  portfolioUrls: string[];
  portfolioFields: AdminSubmissionField[];
  submittedMedia: SubmittedMediaBundle;
  hasAdditionalInfo: boolean;
  additionalFields: AdminSubmissionField[];
  confirmations: AdminSubmissionConfirmation[];
  checklistGroups: AdminSubmissionChecklistGroup[];
};

const DELIVERY_LABELS: Record<string, string> = {
  travel_to_client: "Travels to client",
  client_comes: "Client comes to vendor",
  travel_both: "Travels to clients and clients travel to vendor",
  ship_to_client: "Delivers to client (e.g. courier)",
};

const TRAVEL_POLICY_LABELS: Record<string, string> = {
  fee_included: "Travel/delivery fee included",
  free_within_base_city:
    "Free delivery within base city (extra charges may apply outside this area)",
  fee_after_booking_request:
    "Travel/delivery fee provided after booking request",
  not_applicable: "Not applicable",
  custom: "Custom rule",
};

function field(label: string, value: unknown, missing = false): AdminSubmissionField {
  const text = String(value ?? "").trim();
  return {
    label,
    value: text || "-",
    missing: missing && !text,
  };
}

function deliverySummary(data: VendorOnboardingData): string {
  const modes = Array.isArray(data.deliveryModes) ? data.deliveryModes : [];
  if (modes.length === 0) return "-";
  const hasBoth =
    modes.includes("travel_both") ||
    (modes.includes("travel_to_client") && modes.includes("client_comes"));
  const labels: string[] = [];
  if (hasBoth) {
    labels.push(DELIVERY_LABELS.travel_both);
  } else {
    if (modes.includes("travel_to_client")) {
      labels.push(DELIVERY_LABELS.travel_to_client);
    }
    if (modes.includes("client_comes")) {
      labels.push(DELIVERY_LABELS.client_comes);
    }
  }
  if (modes.includes("ship_to_client")) {
    labels.push(DELIVERY_LABELS.ship_to_client);
  }
  return labels.join(" · ");
}

function travelPolicySummary(data: VendorOnboardingData): string {
  if (!data.travelDeliveryPolicy) return "-";
  if (data.travelDeliveryPolicy === "custom") {
    return String(data.travelDeliveryPolicyCustomText ?? "").trim() || "Custom rule";
  }
  return TRAVEL_POLICY_LABELS[data.travelDeliveryPolicy] ?? data.travelDeliveryPolicy;
}

function checklistItem(
  id: string,
  label: string,
  detail: string,
  status: AdminSubmissionChecklistStatus,
): AdminSubmissionChecklistItem {
  return { id, label, detail, status };
}

function pass(id: string, label: string, detail: string): AdminSubmissionChecklistItem {
  return checklistItem(id, label, detail, "pass");
}

function warn(id: string, label: string, detail: string): AdminSubmissionChecklistItem {
  return checklistItem(id, label, detail, "warn");
}

function info(id: string, label: string, detail: string): AdminSubmissionChecklistItem {
  return checklistItem(id, label, detail, "info");
}

function splitLabels(csv: string): string[] {
  if (!csv || csv === "-") return [];
  return csv.split(", ").map((s) => s.trim()).filter(Boolean);
}

export function buildAdminVendorSubmissionReviewModel(
  data: VendorOnboardingData,
): AdminVendorSubmissionReviewModel {
  const market = getMarket(data.countryCode);
  const radiusLabel =
    radiusOptionsForMarket(market).find((o) => o.value === data.travelRadius)?.label ??
    "-";
  const blockedDates = formatReviewBlockedDates(
    Array.isArray(data.blockedDates) ? data.blockedDates : [],
  );
  const portfolioUrls = portfolioImageUrlsFromPayload({
    portfolioFileNames: Array.isArray(data.portfolioFileNamesPersisted)
      ? data.portfolioFileNamesPersisted
      : [],
  });
  const submittedMedia = buildSubmittedMediaBundle(data);
  const vendorPayload = vendorDataToPayload(data);
  const pricingOptions = buildBrowsePricingOptions({
    user_id: "",
    payload: vendorPayload,
  });
  const pricingSharedContext = extractBrowsePricingSharedContext(vendorPayload, pricingOptions);

  const firstName = String(data.firstName ?? "");
  const lastName = String(data.lastName ?? "");
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "-";
  const businessName = String(data.businessName ?? "").trim() || "Unnamed business";
  const initials =
    (firstName[0] ?? businessName[0] ?? "?").toUpperCase() +
    (lastName[0] ?? "").toUpperCase();

  const packageList = Array.isArray(data.packages) ? data.packages : [];
  const configuredPackages = packageList
    .filter(
      (p) =>
        String(p.title ?? "").trim() ||
        String(p.price ?? "").trim() ||
        String(p.details ?? "").trim() ||
        String(p.duration ?? "").trim(),
    )
    .map((p) => ({
      title: String(p.title ?? "").trim() || "Untitled package",
      price: String(p.price ?? "").trim() ? `£${String(p.price ?? "").trim()}` : "-",
      duration: String(p.duration ?? "").trim() || "-",
      details: String(p.details ?? "").trim(),
      travel: packageTravelPolicyLabel(data, p.useDefaultTravelPackage ?? true),
    }));

  const additionalFields: AdminSubmissionField[] = [];
  if (hasAdditionalInfoContent(data)) {
    const dietary: string[] = [];
    if (data.isHalal) dietary.push("Halal");
    if (data.isVegan) dietary.push("Vegan");
    if (data.isVegetarian) dietary.push("Vegetarian");
    if (data.isGlutenFree) dietary.push("Gluten-free");
    if (dietary.length) {
      additionalFields.push(field("Dietary options", dietary.join(", ")));
    }
    if (String(data.allergenInfo ?? "").trim()) {
      additionalFields.push(field("Allergen info", data.allergenInfo));
    }
  }

  const portfolioFields: AdminSubmissionField[] = [];
  if (Array.isArray(data.socialLinks) && data.socialLinks.length) {
    portfolioFields.push(
      field(
        "Social links",
        data.socialLinks
          .map((s) => {
            const platform =
              SOCIAL_PLATFORM_OPTIONS.find((o) => o.value === s.platform)?.label ??
              s.platform;
            return `${platform}: ${s.handle || "-"}`;
          })
          .join(", "),
      ),
    );
  }

  const servicesOffered = Array.isArray(data.servicesOffered)
    ? data.servicesOffered.map(String)
    : [];
  const eventTypes = Array.isArray(data.eventTypes) ? data.eventTypes.map(String) : [];

  const bio = String(data.aiBioDraft ?? "").trim();
  const profileImageUrl = String(data.profileImageUrl ?? "").trim() || null;
  const email = String(data.email ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const baseCity = String(data.baseCity ?? "").trim();
  const hourly = String(data.hourlyRate ?? "").trim();
  const daily = String(data.dailyRate ?? "").trim();
  const bioWordCount = bio ? bio.split(/\s+/).filter(Boolean).length : 0;

  const serviceLabels = splitLabels(formatReviewServices(servicesOffered));
  const eventTypeLabels = splitLabels(formatReviewEventTypes(eventTypes));

  const checklistGroups: AdminSubmissionChecklistGroup[] = [
    {
      id: "identity",
      title: "Identity & contact",
      items: [
        profileImageUrl
          ? pass("profile-photo", "Profile photo", "Uploaded")
          : warn("profile-photo", "Profile photo", "Not uploaded"),
        fullName !== "-"
          ? pass("contact-name", "Contact name", fullName)
          : warn("contact-name", "Contact name", "Missing"),
        businessName !== "Unnamed business"
          ? pass("business-name", "Business name", businessName)
          : warn("business-name", "Business name", "Missing"),
        email
          ? pass("email", "Login email", email)
          : warn("email", "Login email", "Missing"),
        phone
          ? pass("phone", "Phone number", phone)
          : warn("phone", "Phone number", "Missing"),
        baseCity
          ? pass("base-city", "Base city", baseCity)
          : warn("base-city", "Base city", "Missing"),
      ],
    },
    {
      id: "listing",
      title: "Listing content",
      items: [
        bio
          ? pass("bio", "Public bio", `${bioWordCount} word${bioWordCount === 1 ? "" : "s"}`)
          : warn("bio", "Public bio", "Empty"),
        serviceLabels.length > 0
          ? pass("services", "Services", serviceLabels.join(", "))
          : warn("services", "Services", "None selected"),
        eventTypeLabels.length > 0
          ? pass("event-types", "Event types", eventTypeLabels.join(", "))
          : warn("event-types", "Event types", "None selected"),
      ],
    },
    {
      id: "pricing",
      title: "Pricing & packages",
      items: [
        hourly
          ? pass("hourly", "Hourly rate", `£${hourly}`)
          : info("hourly", "Hourly rate", "Not set"),
        daily
          ? pass("daily", "Daily rate", `£${daily}`)
          : info("daily", "Daily rate", "Not set"),
        configuredPackages.length > 0
          ? pass(
              "packages",
              "Packages",
              `${configuredPackages.length} package${configuredPackages.length === 1 ? "" : "s"} listed`,
            )
          : warn("packages", "Packages", "None submitted"),
        data.offerDiscounts
          ? info(
              "discounts",
              "Discounts",
              (formatDiscountSummary(data) ?? []).join(" · ") || "Enabled, no details",
            )
          : info("discounts", "Discounts", "Not offered"),
      ],
    },
    {
      id: "media",
      title: "Portfolio & availability",
      items: [
        portfolioUrls.length > 0
          ? pass(
              "portfolio",
              "Portfolio photos",
              `${portfolioUrls.length} photo${portfolioUrls.length === 1 ? "" : "s"}`,
            )
          : warn("portfolio", "Portfolio photos", "None uploaded"),
        Array.isArray(data.availableWeekdays) && data.availableWeekdays.length > 0
          ? info(
              "availability",
              "Available days",
              data.availableWeekdays.map((i) => WEEKDAY_LABELS[i] ?? String(i)).join(", "),
            )
          : info("availability", "Available days", "Not set"),
        blockedDates
          ? info("blocked-dates", "Blocked dates", blockedDates)
          : info("blocked-dates", "Blocked dates", "None"),
      ],
    },
    {
      id: "legal",
      title: "Legal confirmations",
      items: [
        data.confirmTruthful
          ? pass("truthful", "Truthful details", "Vendor confirmed")
          : warn("truthful", "Truthful details", "Not confirmed"),
        data.confirmTerms
          ? pass("terms", "Terms & policies", "Vendor accepted")
          : warn("terms", "Terms & policies", "Not accepted"),
      ],
    },
  ];

  return {
    profileImageUrl,
    initials,
    fullName,
    businessName,
    bio: bio || "-",
    bioMissing: !bio,
    serviceLabels,
    eventTypeLabels,
    reachFields: [
      field("Login email", data.email, true),
      field("Phone", data.phone, true),
    ],
    locationFields: [
      field("Country", market.label),
      field("Base city", data.baseCity, true),
      ...(String(data.region ?? "").trim() ? [field("Region", data.region)] : []),
      ...(String(data.postalCode ?? "").trim() ? [field("Postcode", data.postalCode)] : []),
      field("Delivery", deliverySummary(data)),
      field("Travel radius", radiusLabel),
      field("Default travel policy", travelPolicySummary(data)),
    ],
    pricingFields: [
      field(
        "Hourly rate",
        String(data.hourlyRate ?? "").trim() ? `£${String(data.hourlyRate ?? "").trim()}` : "-",
      ),
      field(
        "Daily rate",
        String(data.dailyRate ?? "").trim() ? `£${String(data.dailyRate ?? "").trim()}` : "-",
      ),
      field("Offers discounts", data.offerDiscounts ? "Yes" : "No"),
    ],
    pricingOptions,
    pricingSharedContext,
    discountLines: formatDiscountSummary(data) ?? [],
    availabilityFields: [
      field(
        "Available days",
        Array.isArray(data.availableWeekdays) && data.availableWeekdays.length
          ? data.availableWeekdays.map((i) => WEEKDAY_LABELS[i] ?? String(i)).join(", ")
          : "-",
      ),
      field("Max bookings per day", data.maxBookingsPerDay || "-"),
      ...(blockedDates ? [field("Blocked dates", blockedDates)] : []),
    ],
    portfolioUrls,
    portfolioFields,
    submittedMedia,
    hasAdditionalInfo: hasAdditionalInfoContent(data),
    additionalFields,
    confirmations: [
      {
        label: "Confirmed all details are truthful",
        accepted: data.confirmTruthful,
      },
      {
        label: "Accepted Platform Terms of Service and Legal Policies",
        accepted: data.confirmTerms,
      },
    ],
    checklistGroups,
  };
}
