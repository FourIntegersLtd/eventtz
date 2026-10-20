import { VENDOR_SERVICE_OPTIONS, type VendorServiceOption } from "@/lib/vendorServiceCatalog";

export const STEP_LABELS = [
  "Account",
  "Business",
  "Location",
  "Pricing",
  "Cancellation",
  "Availability",
  "Portfolio",
  "Additional info",
  "Review",
  "Submitted",
] as const;

export const SERVICE_OPTIONS: VendorServiceOption[] = [
  ...VENDOR_SERVICE_OPTIONS,
  { value: "other", label: "Other" },
];

/** Step 2 service chips in design order (V02 artboard labels). */
export const BUSINESS_STEP_SERVICE_CHIPS: { value: string; label: string }[] = [
  { value: "catering", label: "Caterer" },
  { value: "dj", label: "DJ" },
  { value: "photography", label: "Photographer" },
  { value: "decor", label: "Florist" },
  { value: "rentals", label: "Venue" },
  { value: "event_planning", label: "Decor" },
  { value: "baking", label: "Cake maker" },
  { value: "mc", label: "MC" },
  { value: "makeup", label: "Makeup artist" },
  { value: "other", label: "Other" },
];

/** Event type values included when “All of the Above” is selected (excludes `all`). */
export const EVENT_TYPE_IDS_ALL = [
  "weddings",
  "birthdays",
  "showers",
  "naming_ceremonies",
] as const;

export const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "weddings", label: "Weddings" },
  { value: "birthdays", label: "Birthdays" },
  { value: "showers", label: "Showers" },
  { value: "naming_ceremonies", label: "Naming ceremonies" },
  { value: "all", label: "All of the above" },
];

/** Google Form for vendors who don’t fit listed categories (Other). */
export const VENDOR_WAITLIST_URL =
  "https://forms.gle/6c4Ezw5MNuQaYr238";

/** Mirror backend `app/features/vendors/list_pricing.py` and `profile_form_validation.py`. */
export const MIN_MONEY_GBP = 0.1;
export const MAX_DISCOUNT_PCT = 100;
export const MAX_MONEY_GBP = 1_000_000;
export const MIN_MAX_BOOKINGS_PER_DAY = 1;
export const MAX_MAX_BOOKINGS_PER_DAY = 20;
export const MIN_PORTFOLIO_IMAGES = 5;
export const MAX_PORTFOLIO_IMAGES = 20;

export const RADIUS_OPTIONS: { value: string; label: string; context: string }[] = [
  { value: "under_50", label: "Under 50 miles", context: "About a 1-hour drive" },
  { value: "from_50_to_100", label: "50-100 miles", context: "Roughly 1-2 hours' drive" },
  { value: "from_100_to_200", label: "100-200 miles", context: "Roughly 2-4 hours' drive" },
  { value: "over_200", label: "Over 200 miles", context: "Long-distance - nationwide reach" },
];

export const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export const SOCIAL_PLATFORM_OPTIONS: {
  value: "instagram" | "tiktok" | "facebook" | "twitter" | "website" | "other";
  label: string;
  placeholder: string;
}[] = [
  { value: "instagram", label: "Instagram", placeholder: "@yourbusiness" },
  { value: "tiktok", label: "TikTok", placeholder: "@yourbusiness" },
  { value: "facebook", label: "Facebook", placeholder: "facebook.com/yourbusiness" },
  { value: "twitter", label: "Twitter / X", placeholder: "@yourbusiness" },
  { value: "website", label: "Website", placeholder: "https://yourbusiness.com" },
  { value: "other", label: "Other", placeholder: "Link or handle" },
];

/**
 * Sections of the live profile editor, each addressable as `/vendor/profile?section=<slug>`
 * so other screens (e.g. the dashboard's refund-policy prompt) can link straight to one.
 * Each section is one wizard step (see `ONBOARDING_STEP`), so a section link and the wizard agree.
 */
export const PROFILE_SECTIONS = [
  { slug: "account", label: "Account", step: 1 },
  { slug: "business", label: "Business", step: 2 },
  { slug: "location", label: "Location", step: 3 },
  { slug: "pricing", label: "Pricing", step: 4 },
  { slug: "cancellation-policy", label: "Cancellation policy", step: 5 },
  { slug: "availability", label: "Availability", step: 6 },
  { slug: "portfolio", label: "Portfolio", step: 7 },
  { slug: "additional-info", label: "Additional info", step: 8 },
  { slug: "review", label: "Review", step: 9 },
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];
export type ProfileSectionSlug = ProfileSection["slug"];

export const CANCELLATION_POLICY_SECTION: ProfileSectionSlug = "cancellation-policy";

/** URL of one profile section. */
export function profileSectionHref(slug: ProfileSectionSlug): string {
  return `/vendor/profile?section=${slug}`;
}

/** The section named by a `?section=` value, or undefined when missing or unknown. */
export function profileSectionFromParam(value: string | null): ProfileSection | undefined {
  return PROFILE_SECTIONS.find((section) => section.slug === value);
}

/** The section shown for a step when the URL names none (step 4 → Pricing). */
export function defaultProfileSectionForStep(step: number): ProfileSectionSlug {
  return PROFILE_SECTIONS.find((section) => section.step === step)?.slug ?? "review";
}
