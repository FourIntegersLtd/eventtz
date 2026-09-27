/**
 * User-facing labels for vendor service keys and event types on the profile.
 * Ported from the baseline `browseLabels.ts`, including the breadcrumb category names.
 */
import { VENDOR_SERVICE_OPTIONS } from "./vendorServiceOptions";

/** Onboarding event types, including the "all of the above" sentinel. */
const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "weddings", label: "Weddings" },
  { value: "birthdays", label: "Birthdays" },
  { value: "showers", label: "Showers" },
  { value: "naming_ceremonies", label: "Naming Ceremonies" },
  { value: "all", label: "All of the Above" },
];

/** Service keys plus the waitlist "other" value stored by older profiles. */
const SERVICE_OPTIONS: { value: string; label: string }[] = [
  ...VENDOR_SERVICE_OPTIONS,
  { value: "other", label: "Other" },
];

/** Older stored keys that should display as the current option. */
const EVENT_TYPE_ALIASES: Record<string, string> = {
  naming_ceremony: "naming_ceremonies",
};

function humanizeSlug(value: string): string {
  const spaced = value.replace(/_/g, " ").trim();
  if (!spaced) return value;
  return spaced
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function labelFromOptions(
  raw: string,
  options: { value: string; label: string }[],
): string | undefined {
  const key = EVENT_TYPE_ALIASES[raw] ?? raw;
  return options.find((option) => option.value === key)?.label;
}

/** Event type values as labels. `all` collapses the list to one line. */
export function displayEventTypes(raw: string[]): string[] {
  if (raw.length === 0) return [];
  if (raw.includes("all")) {
    return [EVENT_TYPE_OPTIONS.find((option) => option.value === "all")?.label ?? "All event types"];
  }
  return raw
    .filter((eventType) => eventType !== "all")
    .map((eventType) => labelFromOptions(eventType, EVENT_TYPE_OPTIONS) ?? humanizeSlug(eventType));
}

/** Service keys as the labels used in onboarding. */
export function displayServicesOffered(raw: string[]): string[] {
  if (raw.length === 0) return [];
  return raw.map((service) => labelFromOptions(service, SERVICE_OPTIONS) ?? humanizeSlug(service));
}

/**
 * Breadcrumb category. A few services use a plural the filter label does not.
 */
export function vendorBrowseCategoryLabel(serviceValue: string | undefined): string {
  if (!serviceValue) return "Vendors";
  if (serviceValue === "photography") return "Photographers";
  if (serviceValue === "event_planning") return "Event planners";
  if (serviceValue === "dj") return "DJs & bands";
  if (serviceValue === "mc") return "MCs & alagas";
  if (serviceValue === "hair_styling") return "Hair stylists";
  return SERVICE_OPTIONS.find((option) => option.value === serviceValue)?.label ?? "Vendors";
}
