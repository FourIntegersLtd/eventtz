import { RADIUS_OPTIONS, WEEKDAY_LABELS } from "@/features/vendor/onboarding/constants";

const TRAVEL_DELIVERY_LABELS: Record<string, string> = {
  fee_included: "Travel or delivery fee is included",
  free_within_base_city:
    "Free within their base city (extra may apply outside)",
  fee_after_booking_request: "Travel or delivery fee confirmed after you enquire",
  not_applicable: "Travel or delivery not needed for this service",
};

/** Client-facing labels (vendor onboarding stores first-person wording). */
const DELIVERY_MODE_LABELS: Record<string, string> = {
  travel_to_client: "Travels to you",
  client_comes: "You visit them",
  travel_both: "Travels to you or you can visit them",
  ship_to_client: "Can deliver (e.g. courier)",
};

const MAX_BLOCKED_DATES_SHOWN = 8;

function payloadStr(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v.trim() : "";
}

function payloadBool(p: Record<string, unknown>, key: string): boolean {
  return p[key] === true;
}

function asHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s.startsWith("http://") && !s.startsWith("https://")) return null;
  return s;
}

function todayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function formatBlockedDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
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
  /** Upcoming dates the vendor marked unavailable (plain English). */
  unavailableDatesLabel: string | null;
  foodNotes: BrowseVendorFact[];
  trustBadges: string[];
  portfolioVideoUrl: string | null;
};

function formatAvailableWeekdays(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const days = raw
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  if (days.length === 0) return null;
  if (days.length === 7) return "Every day";
  return days.map((d) => WEEKDAY_LABELS[d] ?? String(d)).join(", ");
}

function formatUnavailableDates(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const today = todayUtcIso();
  const upcoming = raw
    .map((d) => String(d).trim().slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today)
    .sort();
  if (upcoming.length === 0) return null;
  const shown = upcoming.slice(0, MAX_BLOCKED_DATES_SHOWN).map(formatBlockedDate);
  const extra = upcoming.length - shown.length;
  if (extra > 0) {
    return `${shown.join("; ")} (+${extra} more)`;
  }
  return shown.join("; ");
}

function formatDeliveryModes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const modes = raw.map((m) => String(m));
  const labels: string[] = [];
  const hasBoth =
    modes.includes("travel_both") ||
    (modes.includes("travel_to_client") && modes.includes("client_comes"));
  if (hasBoth) {
    labels.push(DELIVERY_MODE_LABELS.travel_both);
  } else {
    if (modes.includes("travel_to_client")) {
      labels.push(DELIVERY_MODE_LABELS.travel_to_client);
    }
    if (modes.includes("client_comes")) {
      labels.push(DELIVERY_MODE_LABELS.client_comes);
    }
  }
  if (modes.includes("ship_to_client")) {
    labels.push(DELIVERY_MODE_LABELS.ship_to_client);
  }
  return labels;
}

/**
 * Decision-critical facts from onboarding payload for the client browse detail page.
 * Omits private contact details (phone, email, names) and social links.
 */
export function buildBrowseVendorProfileFacts(
  payload: Record<string, unknown>,
): BrowseVendorProfileFacts {
  const city = payloadStr(payload, "baseCity");
  const region = payloadStr(payload, "region");
  const locationLine = [city, region].filter(Boolean).join(", ");

  const radiusRaw = payloadStr(payload, "travelRadius");
  const travelRadiusLabel =
    RADIUS_OPTIONS.find((o) => o.value === radiusRaw)?.label ?? null;

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
  if (payloadBool(payload, "isHalal")) {
    foodNotes.push({ label: "Halal", value: "Yes" });
  }
  const allergen = payloadStr(payload, "allergenInfo");
  if (allergen) {
    foodNotes.push({ label: "Allergens & dietary", value: allergen });
  }

  const trustBadges: string[] = [];
  if (payloadStr(payload, "foodHygieneCertNamePersisted")) {
    trustBadges.push("Food hygiene certificate on file");
  }
  if (payloadStr(payload, "indemnityCertNamePersisted")) {
    trustBadges.push("Public liability insurance on file");
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
    portfolioVideoUrl: asHttpUrl(payload.portfolioVideoNamePersisted),
  };
}
