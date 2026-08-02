"use client";

import {
  AlertTriangle,
  ExternalLink,
  Star,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { StarRating } from "@/components/ui/StarRating";
import { VendorProfileStatusBadge } from "@/components/ui/VendorProfileStatusBadge";
import { adminTrustReviewsHref } from "@/features/admin/reviews/reviewFormatters";
import type { AdminVendorInsights, AdminVendorRow } from "@/lib/adminVendorsApi";
import { VendorPanelCard, VendorPanelSection } from "./vendorDetailsPanel";
import { BookingStatusBreakdown, QuickLinkRow } from "./vendorDetailsShared";

type Props = {
  vendor: AdminVendorRow;
  businessName: string;
  insights: AdminVendorInsights | null;
  insightsLoading: boolean;
  insightsError: string | null;
};

function MetricRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] text-neutral-500">{label}</p>
        {sub ? <div className="mt-1.5 text-xs leading-relaxed text-neutral-500">{sub}</div> : null}
      </div>
      <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
    </div>
  );
}

export function VendorDetailsInsightsSection({
  vendor,
  businessName,
  insights,
  insightsLoading,
  insightsError,
}: Props) {
  if (insightsLoading) {
    return (
      <VendorPanelSection title="Insights" description="Loading marketplace stats…">
        <VendorPanelCard>
          <LoadingState label="Loading stats…" variant="inline" />
        </VendorPanelCard>
      </VendorPanelSection>
    );
  }

  if (!insights) {
    return insightsError ? (
      <VendorPanelSection title="Insights" description="Marketplace activity and reputation">
        <VendorPanelCard>
          <p className="text-sm text-amber-900">{insightsError}</p>
        </VendorPanelCard>
      </VendorPanelSection>
    ) : null;
  }

  return (
    <div className="space-y-8">
      {insightsError ? (
        <VendorPanelSection title="Notice" description="Some stats may be incomplete">
          <VendorPanelCard>
            <p className="text-sm text-amber-900">{insightsError}</p>
          </VendorPanelCard>
        </VendorPanelSection>
      ) : null}

      <VendorPanelSection title="Quick links" description="Open related admin and public pages">
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLinkRow
            href={insights.explore_path}
            icon={ExternalLink}
            label="View public profile"
            external
          />
          <QuickLinkRow
            href={adminTrustReviewsHref({
              vendorUserId: vendor.user_id,
              vendorName: businessName,
            })}
            icon={Star}
            label="View reviews"
          />
          {insights.open_disputes_on_bookings > 0 ? (
            <QuickLinkRow
              href="/admin/trust?tab=disputes"
              icon={AlertTriangle}
              label="Open disputes queue"
            />
          ) : null}
        </div>
      </VendorPanelSection>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <VendorPanelSection
          title="Marketplace stats"
          description="Ratings, bookings, and onboarding progress"
        >
          <VendorPanelCard>
            <div className="divide-y divide-neutral-100">
              <MetricRow
                label="Avg. rating"
                value={
                  insights.review_count > 0 && insights.review_average != null ? (
                    <span className="inline-flex items-center gap-2">
                      <StarRating rating={Math.round(insights.review_average)} size="sm" />
                      {insights.review_average.toFixed(2)}
                    </span>
                  ) : (
                    "-"
                  )
                }
                sub={
                  insights.review_count > 0
                    ? `${insights.review_count} visible review${insights.review_count === 1 ? "" : "s"}`
                    : "No reviews yet"
                }
              />
              <MetricRow
                label="Total bookings"
                value={insights.bookings_total}
                sub="All time"
              />
              <MetricRow
                label="Open disputes"
                value={insights.open_disputes_on_bookings}
              />
              <MetricRow
                label="Onboarding"
                value={`Step ${vendor.current_step ?? "-"}`}
                sub={<VendorProfileStatusBadge status={vendor.status} />}
              />
            </div>
          </VendorPanelCard>
        </VendorPanelSection>

        <VendorPanelSection
          title="Bookings breakdown"
          description="Status mix across all vendor bookings"
        >
          <VendorPanelCard>
            <BookingStatusBreakdown byStatus={insights.bookings_by_status} />
          </VendorPanelCard>
        </VendorPanelSection>
      </div>
    </div>
  );
}
