/** Parses `/admin/commerce?tab=` — unknown values fall back to bookings. */

export const COMMERCE_TABS = ["bookings", "financials", "marketplace"] as const;

export type CommerceTab = (typeof COMMERCE_TABS)[number];

export function parseCommerceTab(tabParam: string | null): CommerceTab {
  if (tabParam === "financials" || tabParam === "marketplace" || tabParam === "bookings") {
    return tabParam;
  }
  return "bookings";
}
