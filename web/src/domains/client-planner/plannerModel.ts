/**
 * Pure view-model helpers for the celebration planner: which vendors can be
 * booked together, the marketplace handoff URL, and the recent-plans row.
 */
import type { components } from "@/foundation/platform-client";
import {
  PLAN_EVENT_ID,
  PLAN_EVENT_NAME,
  PLAN_FROM_PLANNER,
  PLAN_NOTES,
  PLAN_VENUE,
  eventPrefillFromCelebrationPlan,
  type PlanDetail,
} from "@/domains/client-planner/bookUrl";
import { formatGbp } from "@/domains/client-planner/format";

export type { PlanDetail } from "@/domains/client-planner/bookUrl";
export type PlannerVendorCard = components["schemas"]["PlannerVendorCard"];
export type PlanRecommendation = components["schemas"]["PlanRecommendation"];
export type PlanListItem = components["schemas"]["PlanListItem"];

/** "Price on request", or "from £500", matching the baseline vendor row. */
export function formatVendorPrice(vendor: PlannerVendorCard): string {
  if (vendor.price_on_request || vendor.min_list_price_gbp == null) {
    return "Price on request";
  }
  return `from ${formatGbp(vendor.min_list_price_gbp)}`;
}

/** "London · 100 guests · £10,000 · 2026-09-20", omitting anything the plan doesn't have. */
export function celebrationMetaLine(plan: PlanDetail): string {
  const celebration = plan.celebration;
  const parts: string[] = [];
  if (celebration.location) parts.push(celebration.location);
  if (celebration.guest_count) parts.push(`${celebration.guest_count} guests`);
  if (celebration.budget_gbp != null) parts.push(formatGbp(celebration.budget_gbp));
  if (celebration.preferred_date) parts.push(celebration.preferred_date);
  return parts.join(" · ");
}

/** Primary recommended vendors that can receive a shared enquiry. Unavailable cards are skipped. */
export function primaryVendorsFromPlan(plan: PlanDetail): PlannerVendorCard[] {
  return plan.recommendations
    .map((recommendation) => recommendation.primary)
    .filter((vendor): vendor is PlannerVendorCard => vendor != null && !vendor.unavailable);
}

/**
 * Marketplace URL for "Browse these vendors".
 *
 * Same query the baseline's `buildMarketplaceSearchUrl` emits for a planner
 * handoff: prompt, location, one date, vendor ids, plan id, and event prefill.
 * The default country (`GB`) is omitted.
 */
export function buildPlannerBrowseUrl(plan: PlanDetail, linkedEventId: string): string {
  const prefill = eventPrefillFromCelebrationPlan(plan);
  const vendorIds = primaryVendorsFromPlan(plan).map((vendor) => vendor.user_id);
  const params = new URLSearchParams();
  const query = plan.brief.raw_prompt?.trim() || plan.celebration.title?.trim() || "";
  if (query) params.set("q", query);
  const location = plan.celebration.location?.trim() || plan.brief.location?.trim() || "";
  if (location) params.set("location", location);
  // Country is omitted: planner handoff is always the UK default, and the
  // baseline's marketplace URL drops `country=GB`.
  if (prefill.eventDate) params.set("dates", prefill.eventDate);
  if (vendorIds.length > 0) params.set("vendor_ids", vendorIds.join(","));
  params.set(PLAN_FROM_PLANNER, plan.plan_id);
  if (prefill.eventName.trim()) params.set(PLAN_EVENT_NAME, prefill.eventName.trim());
  if (prefill.venueAddress.trim()) params.set(PLAN_VENUE, prefill.venueAddress.trim());
  if (prefill.notes.trim()) params.set(PLAN_NOTES, prefill.notes.trim());
  if (linkedEventId) params.set(PLAN_EVENT_ID, linkedEventId);
  const queryString = params.toString();
  return queryString ? `/client/browse?${queryString}` : "/client/browse";
}

/** The recent-plans list only shows plans the client has not archived. */
export function activePlans(plans: readonly PlanListItem[]): PlanListItem[] {
  return plans.filter((plan) => plan.status === "active");
}

/** "London · wedding" under a recent-plan title. Underscores in the event type become spaces. */
export function recentPlanSubtitle(plan: PlanListItem): string {
  const eventType = plan.event_type.replace(/_/g, " ");
  return [plan.location, eventType].filter((part): part is string => Boolean(part)).join(" · ");
}

/**
 * Swap one need's recommendation into a plan already on screen.
 *
 * `POST .../replace` returns only that need, not the whole plan. The caller
 * reloads the plan afterwards so the budget (recomputed on the server) catches up.
 */
export function planWithReplacedRecommendation(plan: PlanDetail, recommendation: PlanRecommendation): PlanDetail {
  return {
    ...plan,
    recommendations: plan.recommendations.map((current) =>
      current.need_id === recommendation.need_id ? recommendation : current,
    ),
  };
}
