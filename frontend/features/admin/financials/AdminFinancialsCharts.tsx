"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { AdminAreaChart } from "@/features/admin/components/AdminAreaChart";
import { AdminBarChart } from "@/features/admin/components/AdminBarChart";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { FINANCIALS_CHART_INFO } from "@/features/admin/components/adminChartInfoCopy";
import { chartHasData } from "@/features/admin/components/chartUtils";
import type { AdminFinancialsSummary } from "@/lib/adminPlatformApi";

type AdminFinancialsChartsProps = {
  summary: AdminFinancialsSummary;
};

export function AdminFinancialsCharts({ summary }: AdminFinancialsChartsProps) {
  const daily = summary.daily ?? [];
  const feeData = daily.map((d) => ({ date: d.date, value: d.platform_fee_gbp }));
  const spendData = daily.map((d) => ({ date: d.date, value: d.gmv_gbp }));
  const countData = daily.map((d) => ({ date: d.date, value: d.count }));
  const hasFee = chartHasData(feeData.map((d) => d.value));
  const hasCounts = chartHasData(countData.map((d) => d.value));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
      <AdminChartCard
        title="Client spend (paid)"
        info={FINANCIALS_CHART_INFO.clientSpend}
      >
        {chartHasData(spendData.map((d) => d.value)) ? (
          <AdminAreaChart data={spendData} valueLabel="Client spend (GBP)" />
        ) : (
          <EmptyState className="border-0 py-8" title="No client spend in this period" />
        )}
      </AdminChartCard>

      <AdminChartCard
        title="Fees & paid bookings"
        subtitle="Platform fee and payment volume"
        info={FINANCIALS_CHART_INFO.feesAndPaid}
      >
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-neutral-600">Platform fee</p>
            {hasFee ? (
              <AdminAreaChart data={feeData} valueLabel="Platform fee (GBP)" />
            ) : (
              <EmptyState className="border-0 py-8" title="No platform fees" />
            )}
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-neutral-600">Paid bookings</p>
            {hasCounts ? (
              <AdminBarChart data={countData} valueLabel="Bookings" color="#0ea5e9" />
            ) : (
              <EmptyState className="border-0 py-8" title="No paid bookings" />
            )}
          </div>
        </div>
      </AdminChartCard>
    </div>
  );
}
