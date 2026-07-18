"use client";

import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  ExternalLink,
  Package,
  ScrollText,
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
  StatCard,
} from "./vendorDetailsShared";

type Props = {
  vendor: AdminVendorRow;
  businessName: string;
  insights: AdminVendorInsights | null;
  insightsLoading: boolean;
  insightsError: string | null;
};

export function VendorDetailsInsightsSection({
  vendor,
  businessName,
  insights,
  insightsLoading,
  insightsError,
}: Props) {
  return (
    <div className="space-y-8">
      {insightsError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {insightsError}
        </p>
      ) : null}
      {insightsLoading ? (
        <LoadingState label="Loading stats…" variant="inline" />
      ) : insights ? (
        <>
          <ProfileSection icon={BarChart3} title="Performance overview">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                icon={Star}
                label="Avg. rating"
                tone={insights.review_count > 0 ? "success" : "default"}
                value={
                  insights.review_count > 0 && insights.review_average != null ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <StarRating rating={Math.round(insights.review_average)} size="md" />
                      <span>{insights.review_average.toFixed(2)}</span>
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
              <StatCard
                icon={Briefcase}
                label="Total bookings"
                value={insights.bookings_total}
                sub={
                  insights.bookings_total === 1
                    ? "1 booking all time"
                    : `${insights.bookings_total} bookings all time`
                }
              />
              <StatCard
                icon={AlertTriangle}
                label="Open disputes"
                tone={insights.open_disputes_on_bookings > 0 ? "danger" : "success"}
                value={insights.open_disputes_on_bookings}
                sub={
                  insights.open_disputes_on_bookings > 0
                    ? `${insights.open_disputes_on_bookings} active`
                    : undefined
                }
              />
              <StatCard
                icon={Package}
                label="Onboarding"
                value={`Step ${vendor.current_step ?? "—"}`}
                sub={<VendorProfileStatusBadge status={vendor.status} />}
              />
            </div>
          </ProfileSection>

          <ProfileSection icon={ScrollText} title="Bookings breakdown">
            <BookingStatusBreakdown byStatus={insights.bookings_by_status} />
          </ProfileSection>

          <ProfileSection icon={ExternalLink} title="Quick links">
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
          </ProfileSection>
        </>
      ) : null}
    </div>
  );
}
