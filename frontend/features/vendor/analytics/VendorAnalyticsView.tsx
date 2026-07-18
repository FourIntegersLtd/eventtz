"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Inbox, Percent } from "lucide-react";
import {
  fetchVendorAnalytics,
  type VendorAnalytics,
} from "@/lib/vendorAnalyticsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { AdminBarChart } from "@/features/admin/components/AdminBarChart";
import { AdminAreaChart } from "@/features/admin/components/AdminAreaChart";
import { AdminDonutChart } from "@/features/admin/components/AdminDonutChart";
import { AdminCommercePeriodFilter } from "@/features/admin/components/AdminCommercePeriodFilter";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { chartHasData } from "@/features/admin/components/chartUtils";
import type { AdminPeriodDays } from "@/features/admin/commerce/commercePeriod";
import { VENDOR_CHART_INFO } from "@/features/vendor/analytics/vendorChartInfoCopy";
import {
  formatVendorMoney,
  formatVendorPct,
  formatVendorSeconds,
  toVendorMonthSeries,
  vendorFunnelDonut,
  vendorOverviewKpis,
} from "@/features/vendor/analytics/vendorAnalyticsModel";

export function VendorAnalyticsView() {
  const [data, setData] = useState<VendorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AdminPeriodDays>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchVendorAnalytics(period));
    } catch (e) {
      setError(getApiErrorDetail(e) ?? "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <LoadingState label="Loading your analytics…" variant="centered" />;
  }

  if (error && !data) {
    return (
      <div className="space-y-3">
        <AdminErrorBanner message={error} />
        <Button variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const kpis = vendorOverviewKpis(data.overview);
  const enquirySeries = toVendorMonthSeries(data.enquiries_by_month, "count");
  const revenueSeries = toVendorMonthSeries(data.revenue_by_month, "revenue_gbp");
  const responseSeries = toVendorMonthSeries(data.response_time_by_month, "avg_seconds", 3600);
  const ratingSeries = toVendorMonthSeries(data.rating_by_month, "avg_rating");
  const funnel = vendorFunnelDonut(data.funnel);
  const funnelTotal = funnel.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="flex justify-end">
        <AdminCommercePeriodFilter
          period={period}
          onPeriodChange={setPeriod}
          menuAlign="right"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminKpiCard
          label="Enquiries"
          value={kpis.enquiries}
          hint={`${kpis.pending} pending`}
          icon={Inbox}
          tone="primary"
        />
        <AdminKpiCard
          label="Conversion"
          value={formatVendorPct(kpis.conversion)}
          hint={`Avg response ${formatVendorSeconds(kpis.avgResponseSeconds)}`}
          icon={Percent}
          tone="info"
        />
        <AdminKpiCard
          label="Completed"
          value={kpis.completed}
          hint={`${formatVendorMoney(kpis.revenue)} revenue`}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <AdminChartCard
            title="Enquiries over time"
            subtitle="New requests per month"
            info={VENDOR_CHART_INFO.enquiries}
          >
            {chartHasData(enquirySeries.map((d) => d.value)) ? (
              <AdminBarChart
                data={enquirySeries}
                valueLabel="Enquiries"
                color="var(--color-primary, #3e1964)"
              />
            ) : (
              <EmptyState className="border-0 py-8" title="No enquiries in this period" />
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Revenue over time"
            subtitle="Paid booking totals per month"
            info={VENDOR_CHART_INFO.revenue}
            footerHref="/vendor/bookings"
            footerLabel="View bookings →"
          >
            {chartHasData(revenueSeries.map((d) => d.value)) ? (
              <AdminAreaChart data={revenueSeries} valueLabel="Revenue" />
            ) : (
              <EmptyState className="border-0 py-8" title="No revenue in this period" />
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Customer rating"
            subtitle="Average score out of 5"
            info={VENDOR_CHART_INFO.rating}
          >
            {chartHasData(ratingSeries.map((d) => d.value)) ? (
              <AdminBarChart
                data={ratingSeries}
                valueLabel="Avg rating"
                color="#10b981"
              />
            ) : (
              <EmptyState className="border-0 py-8" title="No ratings yet" />
            )}
          </AdminChartCard>
        </div>

        <div className="space-y-4">
          <AdminChartCard
            title="Booking funnel"
            subtitle="From profile views to completed"
            info={VENDOR_CHART_INFO.funnel}
          >
            {funnelTotal > 0 ? (
              <AdminDonutChart data={funnel} />
            ) : (
              <EmptyState className="border-0 py-8" title="No funnel activity yet" />
            )}
          </AdminChartCard>

          <AdminChartCard
            title="Response time"
            subtitle="Average reply time (hours)"
            info={VENDOR_CHART_INFO.response}
          >
            {chartHasData(responseSeries.map((d) => d.value)) ? (
              <AdminBarChart
                data={responseSeries}
                valueLabel="Hours"
                color="#f59e0b"
              />
            ) : (
              <EmptyState className="border-0 py-8" title="No response data yet" />
            )}
          </AdminChartCard>
        </div>
      </div>
    </div>
  );
}
