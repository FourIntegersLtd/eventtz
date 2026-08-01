"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { PlannerRecommendation, PlannerVendorCard } from "@/lib/clientPlannerApi";
import { PLANNER_COPY } from "./plannerCopy";
import { formatGbp, formatRating, formatVendorPrice } from "./plannerModel";
import { buildPlannerVendorBookUrl } from "@/features/bookings/eventEnquirePrefill";
import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";
import { PlannerBookNowButton } from "./PlannerBookNowButton";

type RecommendationSectionProps = {
  plan: CelebrationPlanResponse;
  recommendation: PlannerRecommendation;
  replacing: boolean;
  onReplace: () => void;
};

function VendorRow({
  vendor,
  estimatedCost,
  why,
  isPrimary,
}: {
  vendor: PlannerVendorCard;
  estimatedCost?: number | null;
  why?: string;
  isPrimary?: boolean;
}) {
  const rating = formatRating(vendor);
  return (
    <div
      className={
        isPrimary
          ? "rounded-xl border border-primary/15 bg-[#faf8fc] p-4"
          : "rounded-lg border border-neutral-100 bg-white px-3 py-2.5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold text-neutral-900 ${isPrimary ? "text-base" : "text-sm"}`}>
            {vendor.business_name || "Vendor"}
            {vendor.unavailable ? (
              <span className="ml-2 text-xs font-medium text-amber-700">
                {PLANNER_COPY.unavailable}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {[vendor.base_city, rating, formatVendorPrice(vendor)].filter(Boolean).join(" · ")}
          </p>
          {vendor.completed_bookings > 0 ? (
            <p className="mt-0.5 text-xs text-neutral-500">
              {vendor.completed_bookings} completed on Eventtz
            </p>
          ) : null}
        </div>
        {isPrimary && estimatedCost != null ? (
          <p className="shrink-0 text-sm font-semibold tabular-nums text-primary">
            ~{formatGbp(estimatedCost)}
          </p>
        ) : null}
      </div>
      {why ? <p className="mt-2 text-sm leading-relaxed text-neutral-700">{why}</p> : null}
    </div>
  );
}

export function RecommendationSection({
  plan,
  recommendation,
  replacing,
  onReplace,
}: RecommendationSectionProps) {
  const primary = recommendation.primary;
  const linkedEventId = plan.client_event_id ?? null;

  return (
    <section
      id={`plan-need-${recommendation.need_id}`}
      className="scroll-mt-24 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold text-neutral-900">
          {recommendation.label}
          {recommendation.optional ? (
            <span className="ml-2 text-xs font-normal text-neutral-400">optional</span>
          ) : null}
        </h3>
        <span className="text-xs uppercase tracking-wide text-neutral-400">
          {recommendation.service_key}
        </span>
      </div>

      {!primary ? (
        <LottieEmptyPanel
          className="mt-3 border-0 bg-transparent py-4"
          lottie="emptyInbox"
          title={recommendation.empty_reason || "No vendors found for this category yet."}
        />
      ) : (
        <div className="mt-4 space-y-3">
          <VendorRow
            vendor={primary}
            estimatedCost={recommendation.estimated_cost_gbp}
            why={recommendation.why_selected}
            isPrimary
          />
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={buildPlannerVendorBookUrl(primary.user_id, plan, linkedEventId)}
              variant="secondary"
              size="sm"
            >
              {PLANNER_COPY.viewProfileLabel}
            </ButtonLink>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={replacing}
              disabled={replacing}
              onClick={onReplace}
            >
              {PLANNER_COPY.replaceLabel}
            </Button>
            <PlannerBookNowButton plan={plan} vendorUserId={primary.user_id} />
          </div>
          {recommendation.alternatives.length ? (
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Alternatives
              </p>
              <ul className="space-y-2">
                {recommendation.alternatives.map((alt) => (
                  <li key={alt.user_id}>
                    <Link
                      href={buildPlannerVendorBookUrl(alt.user_id, plan, linkedEventId)}
                      className="block transition hover:opacity-90"
                    >
                      <VendorRow vendor={alt} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
