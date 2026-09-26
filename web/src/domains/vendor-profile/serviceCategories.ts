/**
 * Onboardable service categories, label-only (no icon set is available yet —
 * see this workstream's hand-off note in `vendor-shell/portalNav.ts`).
 *
 * Ported from the baseline's `lib/vendorServiceCatalog.ts`'s `VENDOR_SERVICE_OPTIONS`.
 * Keep in sync with the backend's `VENDOR_SERVICE_KEYS`.
 */
export interface VendorServiceOption {
  value: string;
  label: string;
}

export const VENDOR_SERVICE_OPTIONS: readonly VendorServiceOption[] = [
  { value: "baking", label: "Baking" },
  { value: "catering", label: "Catering" },
  { value: "photography", label: "Photography" },
  { value: "makeup", label: "Makeup" },
  { value: "rentals", label: "Rentals" },
  { value: "event_planning", label: "Event planner" },
  { value: "decor", label: "Decor" },
  { value: "dj", label: "DJ / music band" },
  { value: "mc", label: "MC / Alaga" },
  { value: "hair_styling", label: "Hair stylist" },
];

/** The display label for a service key, or a title-cased fallback for an unknown one. */
export function labelForVendorService(value: string): string {
  const match = VENDOR_SERVICE_OPTIONS.find((option) => option.value === value);
  if (match) return match.label;
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
