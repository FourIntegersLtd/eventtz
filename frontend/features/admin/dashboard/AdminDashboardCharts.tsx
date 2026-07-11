"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminAreaChart } from "@/features/admin/components/AdminAreaChart";
import { AdminBarChart } from "@/features/admin/components/AdminBarChart";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { AdminDonutChart } from "@/features/admin/components/AdminDonutChart";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminGroupedBarChart } from "@/features/admin/components/AdminGroupedBarChart";
import { AdminPeriodToggle } from "@/features/admin/components/AdminPeriodToggle";
import { chartHasData } from "@/features/admin/components/chartUtils";
import type { AdminDashboardSummary } from "@/lib/adminPlatformApi";
import {
  useAdminDashboardMetrics,
  type DashboardMetricsPeriod,
} from "@/features/admin/dashboard/useAdminDashboardMetrics";

type AdminDashboardChartsProps = {
  summary: AdminDashboardSummary;
};

function ChartSkeleton() {
  return <Skeleton className="h-[220px] w-full rounded-lg" />;
}

export function AdminDashboardCharts({ summary }: AdminDashboardChartsProps) {
  const [period, setPeriod] = useState<DashboardMetricsPeriod>(30);
  const { metrics, loading, error } = useAdminDashboardMetrics(period);

  const pipelineData = [
    { name: "Pending", value: summary.bookings_pending },
    { name: "Accepted", value: summary.bookings_accepted },
    { name: "Completed", value: summary.bookings_completed },
    { name: "Declined", value: summary.bookings_declined },
    { name: "Cancelled", value: summary.bookings_cancelled },
  ];

  const createdData =
    metrics?.bookings_created.map((b) => ({ date: b.date, value: b.count })) ?? [];
  const gmvData =
    metrics?.bookings_paid.map((b) => ({ date: b.date, value: b.gmv_gbp })) ?? [];
  const signupData = metrics?.signups ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Platform metrics</h2>
        <AdminPeriodToggle value={period} onChange={setPeriod} />
      </div>

      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="grid gap-4 overflow-x-auto lg:grid-cols-2">
        <AdminChartCard title="Booking volume">
          {loading ? (
            <ChartSkeleton />
          ) : chartHasData(createdData.map((d) => d.value)) ? (
            <AdminBarChart data={createdData} valueLabel="Bookings" />
          ) : (
            <EmptyState className="border-0 py-8" title="No bookings in this period" />
          )}
        </AdminChartCard>

        <AdminChartCard
          title="Paid GMV"
          footerHref="/admin/commerce?tab=financials"
          footerLabel="View Financials →"
        >
          {loading ? (
            <ChartSkeleton />
          ) : chartHasData(gmvData.map((d) => d.value)) ? (
            <AdminAreaChart data={gmvData} valueLabel="GMV (GBP)" />
          ) : (
            <EmptyState className="border-0 py-8" title="No paid bookings in this period" />
          )}
        </AdminChartCard>

        <AdminChartCard title="Signups">
          {loading ? (
            <ChartSkeleton />
          ) : chartHasData(
              signupData.flatMap((d) => [d.clients, d.vendors]),
            ) ? (
            <AdminGroupedBarChart data={signupData} />
          ) : (
            <EmptyState className="border-0 py-8" title="No signups in this period" />
          )}
        </AdminChartCard>

        <AdminChartCard
          title="Booking pipeline"
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
