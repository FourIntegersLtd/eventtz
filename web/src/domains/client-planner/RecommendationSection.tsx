"use client";

/**
 * One need on a plan: the primary vendor, alternatives, replace, and book now.
 *
 * Profile links are the book-now URL with whatever event id the plan already
 * has (or none). Book now itself ensures an event before navigating.
 * The rebuilt vendor card has no review count or completed-bookings figure —
 * those fields are not on `PlannerVendorCard`.
 */
import Link from "next/link";
import { Button } from "@/foundation/ui";
import type { PlanDetail, PlanRecommendation, PlannerVendorCard } from "@/domains/client-planner/plannerModel";
import { buildPlannerVendorBookUrl } from "@/domains/client-planner/bookUrl";
import { formatGbp } from "@/domains/client-planner/format";
import { formatVendorPrice } from "@/domains/client-planner/plannerModel";
import { PLANNER_COPY } from "@/domains/client-planner/plannerCopy";
import { PlannerBookNowButton } from "@/domains/client-planner/PlannerBookNowButton";

interface VendorRowProps {
  vendor: PlannerVendorCard;
  estimatedCostGbp?: number | null;
  why?: string | null;
  isPrimary?: boolean;
}

/** One vendor card inside a recommendation, primary or alternative. */
function VendorRow({ vendor, estimatedCostGbp, why, isPrimary = false }: VendorRowProps) {
  const details = [vendor.city, formatVendorPrice(vendor)].filter((part): part is string => Boolean(part)).join(" · ");
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
              <span className="ml-2 text-xs font-medium text-amber-700">{PLANNER_COPY.unavailable}</span>
            ) : null}
          </p>
          {details ? <p className="mt-0.5 text-xs text-neutral-500">{details}</p> : null}
        </div>
        {isPrimary && estimatedCostGbp != null ? (
          <p className="shrink-0 text-sm font-semibold tabular-nums text-primary">~{formatGbp(estimatedCostGbp)}</p>
        ) : null}
      </div>
      {why ? <p className="mt-2 text-sm leading-relaxed text-neutral-700">{why}</p> : null}
    </div>
  );
}

export interface RecommendationSectionProps {
  plan: PlanDetail;
  recommendation: PlanRecommendation;
  replacing: boolean;
  onReplace: () => void;
}

/** A single need: primary pick, replace, book now, and alternatives. */
export function RecommendationSection({ plan, recommendation, replacing, onReplace }: RecommendationSectionProps) {
  const primary = recommendation.primary;
  const linkedEventId = plan.client_event_id ?? null;
  const alternatives = recommendation.alternatives ?? [];

  return (
    <section
      id={`plan-need-${recommendation.need_id}`}
      className="scroll-mt-24 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold text-neutral-900">
          {recommendation.label}
          {recommendation.optional ? (
            <span className="ml-2 text-xs font-normal text-neutral-400">{PLANNER_COPY.optionalMark}</span>
          ) : null}
        </h3>
        <span className="text-xs uppercase tracking-wide text-neutral-400">{recommendation.service_key}</span>
      </div>

      {!primary ? (
        <p className="mt-3 text-sm text-neutral-600">{recommendation.empty_reason || PLANNER_COPY.emptyNeedFallback}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <VendorRow
            vendor={primary}
            estimatedCostGbp={recommendation.estimated_cost_gbp}
            why={recommendation.why_selected}
            isPrimary
          />
          <div className="flex flex-wrap items-start gap-2">
            <Link
              href={buildPlannerVendorBookUrl(primary.user_id, plan, linkedEventId)}
              className="inline-flex items-center justify-center rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-muted"
            >
              {PLANNER_COPY.viewProfileLabel}
            </Link>
            <Button type="button" variant="secondary" loading={replacing} disabled={replacing} onClick={onReplace}>
              {PLANNER_COPY.replaceLabel}
            </Button>
            <PlannerBookNowButton plan={plan} vendorUserId={primary.user_id} />
          </div>
          {alternatives.length ? (
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {PLANNER_COPY.alternativesHeading}
              </p>
              <ul className="space-y-2">
                {alternatives.map((alternative) => (
                  <li key={alternative.user_id}>
                    <Link
                      href={buildPlannerVendorBookUrl(alternative.user_id, plan, linkedEventId)}
                      className="block transition hover:opacity-90"
                    >
                      <VendorRow vendor={alternative} />
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
