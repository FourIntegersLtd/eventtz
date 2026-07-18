"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminMarketplaceAnalytics,
  type AdminMarketplaceAnalytics,
} from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { adminCard } from "@/features/admin/adminTheme";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { AdminBarChart } from "@/features/admin/components/AdminBarChart";
import { AdminDonutChart } from "@/features/admin/components/AdminDonutChart";
import { AdminHorizontalBarChart } from "@/features/admin/components/AdminHorizontalBarChart";
import { AdminCommercePeriodFilter } from "@/features/admin/components/AdminCommercePeriodFilter";
import { AdminInfoHint } from "@/features/admin/components/AdminInfoHint";
import { MARKETPLACE_CHART_INFO } from "@/features/admin/components/adminChartInfoCopy";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import {
  commercePeriodRange,
  type CommercePeriodDays,
} from "@/features/admin/commerce/commercePeriod";
import {
  formatMarketplaceMoney,
  formatMarketplacePct,
  formatMarketplaceSeconds,
  marketplaceOverviewKpis,
  marketplaceSecondaryMeta,
  toMarketplaceCategoryBars,
  toMarketplaceCompletedSeries,
  toMarketplaceDemandSeries,
} from "@/features/admin/marketplace/marketplaceAnalyticsModel";

export function AdminMarketplaceAnalyticsView() {
  const [period, setPeriod] = useState<CommercePeriodDays>(30);
  const [range, setRange] = useState(() => commercePeriodRange(30));
  const [data, setData] = useState<AdminMarketplaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePeriodChange = useCallback((next: CommercePeriodDays) => {
    setPeriod(next);
    setRange(commercePeriodRange(next));
  }, []);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminMarketplaceAnalytics({
        from_date: from,
        to_date: to,
      });
      setData(res);
    } catch (e) {
      setError(getApiErrorDetail(e) ?? "Could not load marketplace analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range.from, range.to);
  }, [load, range.from, range.to]);

  if (loading && !data) {
    return <LoadingState label="Loading marketplace analytics…" variant="centered" />;
  }

  if (error && !data) {
    return (
      <div className="space-y-3">
        <AdminErrorBanner message={error} />
        <Button variant="secondary" onClick={() => void load(range.from, range.to)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;
  const kpis = marketplaceOverviewKpis(data.overview);
  const secondary = marketplaceSecondaryMeta(kpis);
  const demandSeries = toMarketplaceDemandSeries(data.enquiries_by_month);
  const completedSeries = toMarketplaceCompletedSeries(data.completed_by_month);
  const categoryBars = toMarketplaceCategoryBars(data.by_category);
  const failureDonut = data.failure_reasons.map((r) => ({
    name: r.reason.replace(/_/g, " ").toLowerCase(),
    value: r.count,
  }));
  const locations = data.by_location.slice(0, 8);
  const vendors = data.top_vendors.slice(0, 8);
  const recruitHints = [
    ...data.recruitment_hints.categories.map((h) => h.message),
    ...data.recruitment_hints.locations.map((h) => h.message),
  ];

  return (
    <div className="space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="flex justify-end">
        <AdminCommercePeriodFilter period={period} onPeriodChange={handlePeriodChange} />
      </div>

      {/* One overview surface — hero metrics + quiet secondary strip */}
      <section className={`${adminCard} overflow-hidden`}>
        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Overview</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Marketplace health for this period</p>
          </div>
          <AdminInfoHint label="Overview" info={MARKETPLACE_CHART_INFO.overview} />
        </div>
        <div className="grid divide-y divide-neutral-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-5">
            <p className="text-xs text-neutral-500">Enquiries</p>
            <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-neutral-900">
              {kpis.enquiries}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {kpis.vendorsActive} active vendors
            </p>
          </div>
          <div className="px-5 py-5">
            <p className="text-xs text-neutral-500">Conversion</p>
            <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-neutral-900">
              {formatMarketplacePct(kpis.overallConversion)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Avg response {formatMarketplaceSeconds(kpis.avgResponseSeconds)}
            </p>
          </div>
          <div className="px-5 py-5">
            <p className="text-xs text-neutral-500">Completed</p>
            <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-neutral-900">
              {kpis.completed}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Avg {formatMarketplaceMoney(kpis.avgBookingValue)}
            </p>
          </div>
        </div>
        {secondary.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
            {secondary.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}
      </section>

      {recruitHints.length > 0 ? (
        <section className={`${adminCard} px-5 py-4`}>
          <p className="text-sm font-medium text-neutral-900">Recruitment opportunities</p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-600">
            {recruitHints.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <AdminChartCard
            title="Demand over time"
            subtitle="Enquiries per month"
            info={MARKETPLACE_CHART_INFO.demand}
          >
            <AdminBarChart data={demandSeries} valueLabel="Enquiries" />
          </AdminChartCard>
          <AdminChartCard
            title="Bookings over time"
            subtitle="Completed per month"
            info={MARKETPLACE_CHART_INFO.completed}
            footerHref="/admin/commerce?tab=bookings"
            footerLabel="View bookings →"
          >
            <AdminBarChart
              data={completedSeries}
              valueLabel="Completed"
              color="#10b981"
            />
          </AdminChartCard>
          <AdminChartCard
            title="Category performance"
            subtitle="Top categories by enquiries"
            info={MARKETPLACE_CHART_INFO.category}
          >
            {categoryBars.length > 0 ? (
              <AdminHorizontalBarChart
                data={categoryBars}
                valueLabel="Enquiries"
                color="var(--color-primary, #7c3aed)"
              />
            ) : (
              <p className="flex h-[180px] items-center justify-center text-sm text-neutral-500">
                No category data in this period.
              </p>
            )}
          </AdminChartCard>
        </div>

        <div className="space-y-4">
          <AdminChartCard
            title="Failed demand"
            subtitle="Why enquiries did not convert"
            info={MARKETPLACE_CHART_INFO.failures}
          >
            {failureDonut.length > 0 ? (
              <AdminDonutChart data={failureDonut} />
            ) : (
              <p className="flex h-[180px] items-center justify-center text-sm text-neutral-500">
                No failures recorded.
              </p>
            )}
          </AdminChartCard>

          <section className={`${adminCard} overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-neutral-900">Top locations</h2>
                <p className="mt-0.5 text-xs text-neutral-500">By enquiry volume</p>
              </div>
              <AdminInfoHint label="Top locations" info={MARKETPLACE_CHART_INFO.locations} />
            </div>
            {locations.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-500">
                No location data in this period.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {locations.map((r, i) => (
                  <li
                    key={r.key}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-4 shrink-0 text-xs tabular-nums text-neutral-400">
                        {i + 1}
                      </span>
                      <span className="truncate text-neutral-900">{r.key}</span>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums text-neutral-500">
                      <span className="font-medium text-neutral-900">{r.enquiries}</span>
                      <span className="mx-1 text-neutral-300">·</span>
                      {formatMarketplacePct(r.conversion_rate)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${adminCard} overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-neutral-900">Top vendors</h2>
                <p className="mt-0.5 text-xs text-neutral-500">Completed bookings & revenue</p>
              </div>
              <AdminInfoHint label="Top vendors" info={MARKETPLACE_CHART_INFO.vendors} />
            </div>
            {vendors.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-500">
                No vendor data in this period.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {vendors.map((v, i) => (
                  <li
                    key={v.vendor_user_id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-4 shrink-0 text-xs tabular-nums text-neutral-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-neutral-900">{v.business_name}</p>
                        <p className="text-xs text-neutral-500">
                          {v.completed} completed · {formatMarketplaceSeconds(v.avg_response_seconds)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums text-neutral-900">
                        {formatMarketplaceMoney(v.revenue_gbp)}
                      </p>
                      <p className="text-xs tabular-nums text-neutral-500">
                        {formatMarketplacePct(v.conversion_rate)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
