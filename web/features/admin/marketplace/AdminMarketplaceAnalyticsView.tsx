"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import {
  fetchAdminMarketplaceAnalytics,
  type AdminMarketplaceAnalytics,
} from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { EzBarChart } from "@/components/charts/EzBarChart";
import { EzDonutChart } from "@/components/charts/EzDonutChart";
import { EzHorizontalBarChart } from "@/components/charts/EzHorizontalBarChart";
import { AdminCommercePeriodFilter } from "@/features/admin/components/AdminCommercePeriodFilter";
import { AdminInfoHint } from "@/features/admin/components/AdminInfoHint";
import { MARKETPLACE_CHART_INFO } from "@/features/admin/components/adminChartInfoCopy";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import {
  commercePeriodRange,
  type CommercePeriodDays,
} from "@/lib/commercePeriod";
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
import { TablePagination } from "@/components/ui/TablePagination";

const ADMIN_TABLE_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export function AdminMarketplaceAnalyticsView() {
  const [period, setPeriod] = useState<CommercePeriodDays>(30);
  const [range, setRange] = useState(() => commercePeriodRange(30));
  const [data, setData] = useState<AdminMarketplaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryOffset, setCategoryOffset] = useState(0);

  const handlePeriodChange = useCallback((next: CommercePeriodDays) => {
    setPeriod(next);
    setRange(commercePeriodRange(next));
    setCategoryOffset(0);
  }, []);

  const load = useCallback(async (from: string, to: string, categoryPageOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminMarketplaceAnalytics({
        from_date: from,
        to_date: to,
        category_offset: categoryPageOffset,
        category_limit: ADMIN_TABLE_PAGE_SIZE,
      });
      setData(res);
    } catch (e) {
      setError(getApiErrorDetail(e) ?? "Could not load marketplace analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range.from, range.to, categoryOffset);
  }, [load, range.from, range.to, categoryOffset]);

  if (loading && !data) {
    return <LoadingState label="Loading marketplace analytics…" variant="centered" />;
  }

  if (error && !data) {
    return (
      <div className="ez-stack">
        <AdminErrorBanner message={error} />
        <Button variant="secondary" onClick={() => void load(range.from, range.to, categoryOffset)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;
  const kpis = marketplaceOverviewKpis(data.overview);
  const categoryChartRows = data.by_category_chart ?? data.by_category;
  const revenueTotal =
    kpis.revenueGbp > 0
      ? kpis.revenueGbp
      : categoryChartRows.reduce((sum, row) => sum + (Number(row.revenue_gbp) || 0), 0);
  const recruitCategoryKeys = new Set(
    data.recruitment_hints.categories.map((hint) => hint.category.toLowerCase()),
  );
  const secondary = marketplaceSecondaryMeta(kpis);
  const demandSeries = toMarketplaceDemandSeries(data.enquiries_by_month);
  const completedSeries = toMarketplaceCompletedSeries(data.completed_by_month);
  const categoryBars = toMarketplaceCategoryBars(categoryChartRows);
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
    <div className="ez-stack ez-stack--lg">
      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="ez-hrow" style={{ justifyContent: "flex-end" }}>
        <AdminCommercePeriodFilter period={period} onPeriodChange={handlePeriodChange} />
      </div>

      <div className="ez-grid-4">
        <AdminKpiCard
          label="Enquiries"
          value={kpis.enquiries}
          hint={`${kpis.vendorsActive} active vendors`}
        />
        <AdminKpiCard label="Completed bookings" value={kpis.completed} />
        <AdminKpiCard
          label="Conversion"
          value={formatMarketplacePct(kpis.overallConversion)}
          hint={`Avg response ${formatMarketplaceSeconds(kpis.avgResponseSeconds)}`}
        />
        <AdminKpiCard
          label="Revenue"
          value={formatMarketplaceMoney(revenueTotal)}
          hint={`Avg booking ${formatMarketplaceMoney(kpis.avgBookingValue)}`}
        />
      </div>
      <div className="ez-hrow" style={{ justifyContent: "flex-end" }}>
        <AdminInfoHint label="Overview" info={MARKETPLACE_CHART_INFO.overview} />
      </div>
      {secondary.length > 0 ? (
        <p className="ez-small">{secondary.join(" · ")}</p>
      ) : null}

      {data.by_category.length > 0 ? (
        <section className="ez-card">
          <div className="ez-card__head">
            <h2 className="ez-h3">Category performance and recruitment opportunities</h2>
          </div>
          <div className="ez-table-wrap">
            <table className="ez-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="ez-td-num">Enquiries</th>
                  <th className="ez-td-num">Completed</th>
                  <th className="ez-td-num">Conversion</th>
                  <th className="ez-td-num">Revenue</th>
                  <th>Supply</th>
                </tr>
              </thead>
              <tbody>
                {data.by_category.map((row) => {
                  const needsRecruit = recruitCategoryKeys.has(row.key.toLowerCase());
                  return (
                    <tr key={row.key}>
                      <td className="ez-td-strong">{row.key}</td>
                      <td className="ez-td-num tabular-nums">{row.enquiries}</td>
                      <td className="ez-td-num tabular-nums">{row.completed}</td>
                      <td className="ez-td-num tabular-nums">
                        {formatMarketplacePct(row.conversion_rate)}
                      </td>
                      <td className="ez-td-num tabular-nums">
                        {formatMarketplaceMoney(row.revenue_gbp)}
                      </td>
                      <td>
                        <span
                          className={
                            needsRecruit
                              ? "ez-badge ez-badge--warning"
                              : "ez-badge ez-badge--success"
                          }
                        >
                          {needsRecruit ? "Recruit more" : "Well supplied"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            offset={categoryOffset}
            limit={ADMIN_TABLE_PAGE_SIZE}
            total={data.by_category_total ?? data.by_category.length}
            pageRowCount={data.by_category.length}
            onPrevious={() =>
              setCategoryOffset((current) => Math.max(0, current - ADMIN_TABLE_PAGE_SIZE))
            }
            onNext={() => setCategoryOffset((current) => current + ADMIN_TABLE_PAGE_SIZE)}
          />
          {recruitHints.length > 0 ? (
            <div className="ez-card__body">
              <ul className="ez-stack ez-stack--sm">
                {recruitHints.map((message) => (
                  <li key={message} className="ez-small">
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="ez-stack">
          <AdminChartCard
            title="Demand over time"
            subtitle="Enquiries per month"
            info={MARKETPLACE_CHART_INFO.demand}
          >
            <EzBarChart data={demandSeries} valueLabel="Enquiries" />
          </AdminChartCard>
          <AdminChartCard
            title="Bookings over time"
            subtitle="Completed per month"
            info={MARKETPLACE_CHART_INFO.completed}
            footerHref="/admin/commerce?tab=bookings"
            footerLabel="View bookings →"
          >
            <EzBarChart
              data={completedSeries}
              valueLabel="Completed"
              color="var(--ez-chart-3)"
            />
          </AdminChartCard>
          <AdminChartCard
            title="Category performance"
            subtitle="Top categories by enquiries"
            info={MARKETPLACE_CHART_INFO.category}
          >
            {categoryBars.length > 0 ? (
              <EzHorizontalBarChart
                data={categoryBars}
                valueLabel="Enquiries"
                color="var(--ez-chart-1)"
              />
            ) : (
              <p className="flex h-[180px] items-center justify-center text-sm text-neutral-500">
                No category data in this period.
              </p>
            )}
          </AdminChartCard>
        </div>

        <div className="ez-stack">
          <AdminChartCard
            title="Failed demand"
            subtitle="Why enquiries did not convert"
            info={MARKETPLACE_CHART_INFO.failures}
          >
            {failureDonut.length > 0 ? (
              <EzDonutChart data={failureDonut} />
            ) : (
              <p className="flex h-[180px] items-center justify-center text-sm text-neutral-500">
                No failures recorded.
              </p>
            )}
          </AdminChartCard>

          <section className={`ez-card overflow-hidden`}>
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

          <section className={`ez-card overflow-hidden`}>
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
