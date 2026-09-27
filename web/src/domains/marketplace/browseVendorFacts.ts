/**
 * Decision-critical facts from a vendor onboarding payload for the public profile.
 * Omits private contact details. Ported from the baseline `browseVendorFacts.ts`.
 */

const TRAVEL_DELIVERY_LABELS: Record<string, string> = {
  fee_included: "Travel or delivery fee is included",
  free_within_base_city: "Free within their base city (extra may apply outside)",
  fee_after_booking_request: "Travel or delivery fee confirmed after you enquire",
  not_applicable: "Travel or delivery not needed for this service",
};

/** Client-facing labels. Onboarding stores the vendor's own wording. */
const DELIVERY_MODE_LABELS: Record<string, string> = {
  travel_to_client: "Travels to you",
  client_comes: "You visit them",
  travel_both: "Travels to you or you can visit them",
  ship_to_client: "Can deliver (e.g. courier)",
};

const RADIUS_OPTIONS: { value: string; label: string }[] = [
  { value: "under_50", label: "Under 50 miles" },
  { value: "from_50_to_100", label: "50-100 miles" },
  { value: "from_100_to_200", label: "100-200 miles" },
  { value: "over_200", label: "Over 200 miles" },
];

/** Index 0 is Monday, matching the weekday numbers stored on the profile. */
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MAX_BLOCKED_DATES_SHOWN = 8;

/** A string field from the payload, or "" when it is not a string. Does not trim. */
export function payloadStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function payloadStr(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function payloadBool(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true;
}

function asHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null;
  return trimmed;
}

function formatBlockedDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type BrowseVendorFact = {
  label: string;
  value: string;
};

export type BrowseVendorProfileFacts = {
  locationLine: string;
  howTheyWork: string[];
  travelRadiusLabel: string | null;
  travelFeePolicy: string | null;
  travelCustomNote: string | null;
  availableDays: string | null;
  /** Upcoming dates the vendor marked unavailable. */
  unavailableDatesLabel: string | null;
  foodNotes: BrowseVendorFact[];
  trustBadges: string[];
  portfolioVideoUrls: string[];
};

function formatAvailableWeekdays(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const days = raw
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((left, right) => left - right);
  if (days.length === 0) return null;
  if (days.length === 7) return "Every day";
  return days.map((day) => WEEKDAY_LABELS[day] ?? String(day)).join(", ");
}

function formatUnavailableDates(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid = raw
    .map((day) => String(day).trim().slice(0, 10))
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort();
  if (valid.length === 0) return null;
  const shown = valid.slice(0, MAX_BLOCKED_DATES_SHOWN).map(formatBlockedDate);
  const extra = valid.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} (+${extra} more)`;
  return shown.join(", ");
}

function formatDeliveryModes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const modes = raw.map((mode) => String(mode));
  const labels: string[] = [];
  const hasBoth =
    modes.includes("travel_both") ||
    (modes.includes("travel_to_client") && modes.includes("client_comes"));
  if (hasBoth) {
    labels.push(DELIVERY_MODE_LABELS.travel_both!);
  } else {
    if (modes.includes("travel_to_client")) labels.push(DELIVERY_MODE_LABELS.travel_to_client!);
    if (modes.includes("client_comes")) labels.push(DELIVERY_MODE_LABELS.client_comes!);
  }
  if (modes.includes("ship_to_client")) labels.push(DELIVERY_MODE_LABELS.ship_to_client!);
  return labels;
}

/** Facts the profile shows: where they work, food notes, certificates, videos. */
export function buildBrowseVendorProfileFacts(
  payload: Record<string, unknown>,
): BrowseVendorProfileFacts {
  const city = payloadStr(payload, "baseCity");
  const region = payloadStr(payload, "region");
  const locationLine = [city, region].filter(Boolean).join(", ");

  const radiusRaw = payloadStr(payload, "travelRadius");
  const travelRadiusLabel = RADIUS_OPTIONS.find((option) => option.value === radiusRaw)?.label ?? null;

  const policyRaw = payloadStr(payload, "travelDeliveryPolicy");
  let travelFeePolicy: string | null = null;
  let travelCustomNote: string | null = null;
  if (policyRaw === "custom") {
    const custom = payloadStr(payload, "travelDeliveryPolicyCustomText");
    travelCustomNote = custom || null;
    travelFeePolicy = custom ? null : "Custom travel or delivery terms";
  } else if (policyRaw) {
    travelFeePolicy = TRAVEL_DELIVERY_LABELS[policyRaw] ?? null;
  }

  const foodNotes: BrowseVendorFact[] = [];
  if (payloadBool(payload, "isHalal")) foodNotes.push({ label: "Halal", value: "Yes" });
  if (payloadBool(payload, "isVegan")) foodNotes.push({ label: "Vegan", value: "Options available" });
  if (payloadBool(payload, "isVegetarian")) {
    foodNotes.push({ label: "Vegetarian", value: "Options available" });
  }
  if (payloadBool(payload, "isGlutenFree")) {
    foodNotes.push({ label: "Gluten-free", value: "Options available" });
  }
  const allergen = payloadStr(payload, "allergenInfo");
  if (allergen) foodNotes.push({ label: "Allergens & dietary", value: allergen });

  const trustBadges: string[] = [];
  if (payloadStr(payload, "foodHygieneCertNamePersisted")) {
    trustBadges.push("Food hygiene certificate on file");
  }
  if (payloadStr(payload, "indemnityCertNamePersisted")) {
    trustBadges.push("Public liability insurance on file");
  }

  const videoUrls: string[] = [];
  const legacyVideo = asHttpUrl(payload.portfolioVideoNamePersisted);
  if (legacyVideo) videoUrls.push(legacyVideo);
  if (Array.isArray(payload.portfolioVideoNamesPersisted)) {
    for (const item of payload.portfolioVideoNamesPersisted) {
      const url = asHttpUrl(item);
      if (url && !videoUrls.includes(url)) videoUrls.push(url);
    }
  }

  return {
    locationLine,
    howTheyWork: formatDeliveryModes(payload.deliveryModes),
    travelRadiusLabel,
    travelFeePolicy,
    travelCustomNote,
    availableDays: formatAvailableWeekdays(payload.availableWeekdays),
    unavailableDatesLabel: formatUnavailableDates(payload.blockedDates),
    foodNotes,
    trustBadges,
    portfolioVideoUrls: videoUrls,
  };
}
