"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminCard } from "@/features/admin/adminTheme";
import { AdminCommercePeriodFilter } from "@/features/admin/components/AdminCommercePeriodFilter";
import { AdminDonutChart } from "@/features/admin/components/AdminDonutChart";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminGroupedBarChart } from "@/features/admin/components/AdminGroupedBarChart";
import { AdminInfoHint } from "@/features/admin/components/AdminInfoHint";
import { DASHBOARD_CHART_INFO } from "@/features/admin/components/adminChartInfoCopy";
import { chartHasData } from "@/features/admin/components/chartUtils";
import type { AdminPeriodDays } from "@/features/admin/commerce/commercePeriod";
import type { AdminDashboardSummary } from "@/lib/adminPlatformApi";
import { useAdminDashboardMetrics } from "@/features/admin/dashboard/useAdminDashboardMetrics";

type AdminDashboardChartsProps = {
  summary: AdminDashboardSummary;
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

export function AdminDashboardCharts({ summary }: AdminDashboardChartsProps) {
  const [period, setPeriod] = useState<AdminPeriodDays>(30);
  const { metrics, loading, error } = useAdminDashboardMetrics(period);

  const pipelineData = [
    { name: "Pending", value: summary.bookings_pending },
    { name: "Accepted", value: summary.bookings_accepted },
    { name: "Completed", value: summary.bookings_completed },
    { name: "Declined", value: summary.bookings_declined },
    { name: "Cancelled", value: summary.bookings_cancelled },
  ];

  const signupData = metrics?.signups ?? [];
  const pipelineTotal =
    summary.bookings_pending +
    summary.bookings_accepted +
    summary.bookings_completed +
    summary.bookings_declined +
    summary.bookings_cancelled;

  return (
    <section className={`${adminCard} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-neutral-900">Platform overview</h2>
        <AdminCommercePeriodFilter period={period} onPeriodChange={setPeriod} />
      </div>

      {error ? (
        <div className="px-5 pt-4">
          <AdminErrorBanner message={error} />
        </div>
      ) : null}

      <div className="grid divide-y divide-neutral-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="min-w-0 p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-neutral-900">Signups</h3>
            <AdminInfoHint label="Signups" info={DASHBOARD_CHART_INFO.signups} />
          </div>
          {loading ? (
            <ChartSkeleton />
          ) : chartHasData(signupData.flatMap((d) => [d.clients, d.vendors])) ? (
            <AdminGroupedBarChart data={signupData} />
          ) : (
            <EmptyState className="border-0 py-8" title="No signups in this period" />
          )}
        </div>

        <div className="min-w-0 p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-neutral-900">Booking pipeline</h3>
            <AdminInfoHint label="Booking pipeline" info={DASHBOARD_CHART_INFO.pipeline} />
          </div>
          {pipelineTotal === 0 ? (
            <EmptyState className="border-0 py-8" title="No bookings yet" />
          ) : (
            <AdminDonutChart data={pipelineData} />
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
    </section>
  );
}
