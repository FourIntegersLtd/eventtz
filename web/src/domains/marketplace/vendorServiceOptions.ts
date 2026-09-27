/**
 * Onboardable vendor service types.
 * Ported from the baseline `vendorServiceCatalog.ts` — service keys only,
 * no icons or categories (those stay in the baseline).
 */
export type VendorServiceOption = {
  value: string;
  label: string;
};

/** Onboardable service keys — keep in sync with backend `VENDOR_SERVICE_KEYS`. */
export const VENDOR_SERVICE_OPTIONS: VendorServiceOption[] = [
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

/** Look up a human label for a service key. */
export function labelForVendorService(value: string): string {
  return (
    VENDOR_SERVICE_OPTIONS.find((option) => option.value === value)?.label ??
    value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}
