"use client";

import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import type { PlannerRecommendation } from "@/lib/clientPlannerApi";
import { buildPlannerVendorBookUrl } from "@/features/bookings/eventEnquirePrefill";
import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";
import { PLANNER_COPY } from "./plannerCopy";
import { PlannerVendorEzCard } from "./PlannerVendorEzCard";

type RecommendationSectionProps = {
  plan: CelebrationPlanResponse;
  recommendation: PlannerRecommendation;
  replacing: boolean;
  onReplace: () => void;
  selectedVendorIds: Set<string>;
  onToggleVendor: (vendorUserId: string) => void;
};

function sectionCaption(recommendation: PlannerRecommendation, plan: CelebrationPlanResponse): string {
  const guests = plan.celebration.guest_count;
  const location = plan.celebration.location;
  const vendors = [recommendation.primary, ...recommendation.alternatives].filter(Boolean).length;
  if (guests) return `${vendors} matches for ${guests} guests`;
  if (location) return `${vendors} matches in ${location}`;
  return `${vendors} matches`;
}

/** C07 category block with `ez-grid-3` vendor cards. */
export function RecommendationSection({
  plan,
  recommendation,
  replacing,
  onReplace,
  selectedVendorIds,
  onToggleVendor,
}: RecommendationSectionProps) {
  const linkedEventId = plan.client_event_id ?? null;
  const cards = [
    recommendation.primary,
    ...recommendation.alternatives.slice(0, 2),
  ].filter((vendor): vendor is NonNullable<typeof recommendation.primary> => vendor != null);

  return (
    <section className="ez-stack" id={`plan-need-${recommendation.need_id}`}>
      <div className="ez-section-title">
        <div>
          <h2 className="ez-h2">{recommendation.label}</h2>
          <span className="ez-caption">{sectionCaption(recommendation, plan)}</span>
        </div>
        <button
          type="button"
          className="ez-link"
          disabled={replacing || !recommendation.primary}
          onClick={onReplace}
        >
          {PLANNER_COPY.replaceLabel}
        </button>
      </div>

      {!recommendation.primary ? (
        <LottieEmptyPanel
          className="border-0 bg-transparent py-4"
          variant="vendors"
          title={recommendation.empty_reason || "No vendors found for this category yet."}
        />
      ) : (
        <div className="ez-grid-3">
          {cards.map((vendor) => (
            <PlannerVendorEzCard
              key={vendor.user_id}
              vendor={vendor}
              serviceKey={recommendation.service_key}
              profileHref={buildPlannerVendorBookUrl(vendor.user_id, plan, linkedEventId)}
              selected={selectedVendorIds.has(vendor.user_id)}
              onToggleSelected={() => onToggleVendor(vendor.user_id)}
              disabled={replacing}
            />
          ))}
        </div>
      )}
    </section>
  );
}
