"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { AdminCommercePeriodFilter } from "@/features/admin/components/AdminCommercePeriodFilter";
import { AdminDonutChart } from "@/features/admin/components/AdminDonutChart";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminGroupedBarChart } from "@/features/admin/components/AdminGroupedBarChart";
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Platform overview</h2>
        <AdminCommercePeriodFilter period={period} onPeriodChange={setPeriod} />
      </div>

      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="grid gap-4 overflow-x-auto lg:grid-cols-2">
        <AdminChartCard title="Signups" info={DASHBOARD_CHART_INFO.signups}>
          {loading ? (
            <ChartSkeleton />
          ) : chartHasData(signupData.flatMap((d) => [d.clients, d.vendors])) ? (
            <AdminGroupedBarChart data={signupData} />
          ) : (
            <EmptyState className="border-0 py-8" title="No signups in this period" />
          )}
        </AdminChartCard>

        <AdminChartCard
          title="Booking pipeline"
          info={DASHBOARD_CHART_INFO.pipeline}
          footerHref="/admin/commerce?tab=bookings"
          footerLabel="View all bookings →"
        >
          {summary.bookings_pending +
            summary.bookings_accepted +
            summary.bookings_completed +
            summary.bookings_declined +
            summary.bookings_cancelled ===
          0 ? (
            <EmptyState className="border-0 py-8" title="No bookings yet" />
          ) : (
            <AdminDonutChart data={pipelineData} />
          )}
        </AdminChartCard>
      </div>
    </section>
  );
}
