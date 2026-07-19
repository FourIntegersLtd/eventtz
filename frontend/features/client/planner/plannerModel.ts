import type { CelebrationPlanResponse, PlannerVendorCard } from "@/lib/clientPlannerApi";

export function formatGbp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatVendorPrice(v: PlannerVendorCard): string {
  if (v.price_on_request || v.min_list_price_gbp == null) {
    return "Price on request";
  }
  return `from ${formatGbp(v.min_list_price_gbp)}`;
}

export function formatRating(v: PlannerVendorCard): string | null {
  if (v.review_average == null || v.review_count <= 0) return null;
  return `${v.review_average.toFixed(1)}★ (${v.review_count})`;
}

export function celebrationMetaLine(plan: CelebrationPlanResponse): string {
  const c = plan.celebration;
  const parts: string[] = [];
  if (c.location) parts.push(c.location);
  if (c.guest_count) parts.push(`${c.guest_count} guests`);
  if (c.budget_gbp != null) parts.push(formatGbp(c.budget_gbp));
  if (c.preferred_date) parts.push(c.preferred_date);
  return parts.join(" · ");
}

export function vendorProfileHref(userId: string): string {
  return `/client/browse/${encodeURIComponent(userId)}`;
}
