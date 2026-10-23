"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { EzAreaChart } from "@/components/charts/EzAreaChart";
import { EzDonutChart } from "@/components/charts/EzDonutChart";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzGroupedBarChart } from "@/components/charts/EzGroupedBarChart";
import { AdminInfoHint } from "@/features/admin/components/AdminInfoHint";
import { DASHBOARD_CHART_INFO } from "@/features/admin/components/adminChartInfoCopy";
import { chartHasData } from "@/components/charts/chartUtils";
import type { AdminDashboardMetrics, AdminDashboardSummary } from "@/lib/adminPlatformApi";

type AdminDashboardChartsProps = {
  summary: AdminDashboardSummary;
  metrics: AdminDashboardMetrics | null;
  loading: boolean;
  error: string | null;
};

function ChartSkeleton() {
  return (
    <div className="relative h-[220px] w-full">
      <Skeleton className="h-full w-full rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Loading chart">
        <LoadingSpinner size="md" />
      </div>
    </div>
  );
}

export function AdminDashboardCharts({ summary, metrics, loading, error }: AdminDashboardChartsProps) {
  const pipelineData = [
    { name: "Pending", value: summary.bookings_pending },
    { name: "Accepted", value: summary.bookings_accepted },
    { name: "Completed", value: summary.bookings_completed },
    { name: "Declined", value: summary.bookings_declined },
    { name: "Cancelled", value: summary.bookings_cancelled },
  ];

  const signupData = metrics?.signups ?? [];
  const gmvData = (metrics?.bookings_paid ?? []).map((bucket) => ({
    date: bucket.date,
    value: bucket.gmv_gbp,
  }));
  const pipelineTotal =
    summary.bookings_pending +
    summary.bookings_accepted +
    summary.bookings_completed +
    summary.bookings_declined +
    summary.bookings_cancelled;

  return (
    <section className="ez-stack ez-stack--lg">
      <div className="ez-section-title">
        <h2 className="ez-h2">Bookings and enquiries</h2>
        <Link href="/admin/commerce?tab=marketplace" className="ez-link">
          Open analytics
        </Link>
      </div>
      <div className="ez-card overflow-hidden">
        {error ? (
          <div className="px-5 pt-4 sm:px-6">
            <AdminErrorBanner message={error} />
          </div>
        ) : null}

        <div className="grid divide-y divide-neutral-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="min-w-0 p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-neutral-900">Signups</h3>
              <AdminInfoHint label="Signups" info={DASHBOARD_CHART_INFO.signups} />
            </div>
            {loading ? (
              <ChartSkeleton />
            ) : chartHasData(signupData.flatMap((d) => [d.clients, d.vendors])) ? (
              <EzGroupedBarChart data={signupData} />
            ) : (
              <EmptyState className="border-0 py-8" title="No signups in this period" lottie="searchNoResults" />
            )}
          </div>

          <div className="min-w-0 p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-neutral-900">Booking pipeline</h3>
              <AdminInfoHint label="Booking pipeline" info={DASHBOARD_CHART_INFO.pipeline} />
            </div>
            {pipelineTotal === 0 ? (
              <EmptyState className="border-0 py-8" title="No bookings yet" variant="bookings" />
            ) : (
              <EzDonutChart data={pipelineData} />
            )}
            {pipelineTotal > 0 ? (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <Link
                  href="/admin/commerce?tab=bookings"
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:underline"
                >
                  View all bookings →
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ez-card overflow-hidden">
        <div className="ez-card__head">
          <h2 className="ez-h3">Marketplace health</h2>
        </div>
        <div className="ez-card__body">
          {loading ? (
            <ChartSkeleton />
          ) : chartHasData(gmvData.map((d) => d.value)) ? (
            <EzAreaChart data={gmvData} valueLabel="Gross booking value (GBP)" />
          ) : (
            <EmptyState className="border-0 py-8" title="No paid volume in this period" lottie="searchNoResults" />
          )}
        </div>
      </div>
    </section>
  );
}
