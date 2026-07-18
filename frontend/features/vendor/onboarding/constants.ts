export const STEP_LABELS = [
  "Account",
  "Business",
  "Location",
  "Pricing",
  "Availability",
  "Portfolio",
  "Additional info",
  "Review",
  "Submitted",
] as const;

export const SERVICE_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "baking", label: "Baking" },
  { value: "catering", label: "Catering" },
  { value: "photography", label: "Photography" },
  { value: "makeup", label: "Makeup" },
  { value: "rentals", label: "Rentals" },
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
  { value: "naming_ceremonies", label: "Naming Ceremonies" },
  { value: "all", label: "All of the Above" },
];

/** Google Form for vendors who don’t fit listed categories (Other). */
export const VENDOR_WAITLIST_URL =
  "https://forms.gle/6c4Ezw5MNuQaYr238";

/** Mirror backend `app/features/vendors/payload_validation.py`. */
export const MAX_DISCOUNT_PCT = 100;
export const MAX_MONEY_GBP = 1_000_000;
export const MIN_MAX_BOOKINGS_PER_DAY = 1;
export const MAX_MAX_BOOKINGS_PER_DAY = 20;

export const RADIUS_OPTIONS: { value: string; label: string; context: string }[] = [
  { value: "under_50", label: "Under 50 miles", context: "About a 1-hour drive" },
  { value: "from_50_to_100", label: "50-100 miles", context: "Roughly 1-2 hours' drive" },
  { value: "from_100_to_200", label: "100-200 miles", context: "Roughly 2-4 hours' drive" },
  { value: "over_200", label: "Over 200 miles", context: "Long-distance — nationwide reach" },
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
  value: "instagram" | "tiktok" | "facebook" | "website" | "other";
  label: string;
  placeholder: string;
}[] = [
  { value: "instagram", label: "Instagram", placeholder: "@yourbusiness" },
  { value: "tiktok", label: "TikTok", placeholder: "@yourbusiness" },
  { value: "facebook", label: "Facebook", placeholder: "facebook.com/yourbusiness" },
  { value: "website", label: "Website", placeholder: "https://yourbusiness.com" },
  { value: "other", label: "Other", placeholder: "Link or handle" },
];
