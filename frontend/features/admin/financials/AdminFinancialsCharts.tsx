"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { AdminAreaChart } from "@/features/admin/components/AdminAreaChart";
import { AdminBarChart } from "@/features/admin/components/AdminBarChart";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { chartHasData } from "@/features/admin/components/chartUtils";
import type { AdminFinancialsSummary } from "@/lib/adminPlatformApi";

type AdminFinancialsChartsProps = {
  summary: AdminFinancialsSummary;
};

export function AdminFinancialsCharts({ summary }: AdminFinancialsChartsProps) {
  const daily = summary.daily ?? [];
  const feeData = daily.map((d) => ({ date: d.date, value: d.platform_fee_gbp }));
  const countData = daily.map((d) => ({ date: d.date, value: d.count }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AdminChartCard title="Platform fee over time">
        {chartHasData(feeData.map((d) => d.value)) ? (
          <AdminAreaChart data={feeData} valueLabel="Platform fee (GBP)" />
        ) : (
          <EmptyState className="border-0 py-8" title="No platform fees in this period" />
        )}
      </AdminChartCard>

      <AdminChartCard title="Paid bookings">
        {chartHasData(countData.map((d) => d.value)) ? (
          <AdminBarChart data={countData} valueLabel="Bookings" color="#0ea5e9" />
        ) : (
          <EmptyState className="border-0 py-8" title="No paid bookings in this period" />
        )}
      </AdminChartCard>
    </div>
  );
}
