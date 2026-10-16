import type { CelebrationPlanResponse, PlannerVendorCard } from "@/lib/clientPlannerApi";
import { eventPrefillFromCelebrationPlan } from "@/features/bookings/eventEnquirePrefill";
import {
  buildMarketplaceSearchUrl,
  type MarketplaceSearchState,
} from "@/lib/marketplaceSearchParams";
import { DEFAULT_COUNTRY_CODE } from "@/lib/markets";

export function formatGbp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "-";
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

/** Primary recommended vendors that can receive a shared enquiry. */
export function primaryVendorsFromPlan(plan: CelebrationPlanResponse): PlannerVendorCard[] {
  return plan.recommendations
    .map((rec) => rec.primary)
    .filter((v): v is PlannerVendorCard => v != null && !v.unavailable);
}

/** Hand off to client browse - same multi-select + message flow as non-AI users. */
export function buildPlannerBrowseUrl(
  plan: CelebrationPlanResponse,
  linkedEventId: string,
): string {
  const prefill = eventPrefillFromCelebrationPlan(plan);
  const vendorIds = primaryVendorsFromPlan(plan).map((v) => v.user_id);
  const state: MarketplaceSearchState = {
    query: plan.brief.raw_prompt?.trim() || plan.celebration.title?.trim() || "",
    types: [],
    location: plan.celebration.location?.trim() || plan.brief.location?.trim() || "",
    country: DEFAULT_COUNTRY_CODE,
    dates: prefill.eventDate ? [prefill.eventDate] : [],
    dateFlexible: false,
    budgetMin: null,
    budgetMax: null,
    sort: "relevance",
    page: 1,
    vendorIds,
    fromPlannerPlanId: plan.plan_id,
    eventName: prefill.eventName,
    venue: prefill.venueAddress,
    planNotes: prefill.notes,
    linkedEventId,
  };
  return buildMarketplaceSearchUrl("/client/browse", state);
}
