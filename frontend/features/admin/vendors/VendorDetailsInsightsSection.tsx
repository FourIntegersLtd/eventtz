"use client";

import {
  AlertTriangle,
  Briefcase,
  ExternalLink,
  Star,
} from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { StarRating } from "@/components/ui/StarRating";
import { VendorProfileStatusBadge } from "@/components/ui/VendorProfileStatusBadge";
import { adminTrustReviewsHref } from "@/features/admin/reviews/reviewFormatters";
import type { AdminVendorInsights, AdminVendorRow } from "@/lib/adminVendorsApi";
import {
  BookingStatusBreakdown,
  ProfileSection,
  QuickLinkRow,
} from "./vendorDetailsShared";

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
    <div className="flex items-start justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] text-neutral-500">{label}</p>
        {sub ? <div className="mt-0.5 text-xs text-neutral-500">{sub}</div> : null}
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
  return (
    <div className="space-y-6">
      {insightsError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {insightsError}
        </p>
      ) : null}
      {insightsLoading ? (
        <LoadingState label="Loading stats…" variant="inline" />
      ) : insights ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
            <MetricRow
              label="Avg. rating"
              value={
                insights.review_count > 0 && insights.review_average != null ? (
                  <span className="inline-flex items-center gap-2">
                    <StarRating rating={Math.round(insights.review_average)} size="sm" />
                    {insights.review_average.toFixed(2)}
                  </span>
                ) : (
                  "—"
                )
              }
              sub={
                insights.review_count > 0
                  ? `${insights.review_count} visible review${insights.review_count === 1 ? "" : "s"}`
                  : "No reviews yet"
              }
            />
            <div className="border-t border-neutral-100">
              <MetricRow
                label="Total bookings"
                value={insights.bookings_total}
                sub="All time"
              />
            </div>
            <div className="border-t border-neutral-100">
              <MetricRow
                label="Open disputes"
                value={insights.open_disputes_on_bookings}
              />
            </div>
            <div className="border-t border-neutral-100">
              <MetricRow
                label="Onboarding"
                value={`Step ${vendor.current_step ?? "—"}`}
                sub={<VendorProfileStatusBadge status={vendor.status} />}
              />
            </div>
          </div>

          <ProfileSection icon={Briefcase} title="Bookings breakdown">
            <BookingStatusBreakdown byStatus={insights.bookings_by_status} />
          </ProfileSection>

          <div className="space-y-2">
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
        </>
      ) : null}
    </div>
  );
}
