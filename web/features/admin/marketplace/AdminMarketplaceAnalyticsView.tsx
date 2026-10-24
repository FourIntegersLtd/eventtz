"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import {
  fetchAdminMarketplaceAnalytics,
  type AdminMarketplaceAnalytics,
} from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatTile } from "@/components/ui/StatTile";
import { AdminChartCard } from "@/features/admin/components/AdminChartCard";
import { EzBarChart } from "@/components/charts/EzBarChart";
import { EzDonutChart } from "@/components/charts/EzDonutChart";
import { EzHorizontalBarChart } from "@/components/charts/EzHorizontalBarChart";
import { EzPeriodFilterButton } from "@/components/ui/EzPeriodFilterButton";
import { ADMIN_PERIOD_OPTIONS } from "@/lib/commercePeriod";
import { AdminInfoHint } from "@/features/admin/components/AdminInfoHint";
import { MARKETPLACE_CHART_INFO } from "@/features/admin/components/adminChartInfoCopy";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import {
  commercePeriodRange,
  type CommercePeriodDays,
} from "@/lib/commercePeriod";
import {
  formatMarketplacePct,
  formatMarketplaceSeconds,
  marketplaceOverviewKpis,
  marketplaceSecondaryMeta,
  toMarketplaceCategoryBars,
  toMarketplaceCompletedSeries,
  toMarketplaceDemandSeries,
} from "@/features/admin/marketplace/marketplaceAnalyticsModel";
import { RankedListCard } from "@/features/admin/marketplace/RankedListCard";
import { TablePagination } from "@/components/ui/TablePagination";
import { formatGbp } from "@/lib/money";

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
  const categoryChartRows = data.by_category_chart;
  // The overview carries no revenue total, so revenue is the sum over the categories.
  const revenueTotal = categoryChartRows.reduce((sum, row) => sum + row.revenue_gbp, 0);
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

      <div className="ez-hrow justify-end">
        <EzPeriodFilterButton options={ADMIN_PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} defaultValue={30} />
      </div>

      <div className="ez-grid-4">
        <StatTile
          label="Enquiries"
          value={kpis.enquiries}
          hint={`${kpis.vendorsActive} active vendors`}
        />
        <StatTile label="Completed bookings" value={kpis.completed} />
        <StatTile
          label="Conversion"
          value={formatMarketplacePct(kpis.overallConversion)}
          hint={`Avg response ${formatMarketplaceSeconds(kpis.avgResponseSeconds)}`}
        />
        <StatTile
          label="Revenue"
          value={formatGbp(revenueTotal, { decimals: 0, grouping: false })}
          hint={`Avg booking ${formatGbp(kpis.avgBookingValue, { decimals: 0, grouping: false })}`}
        />
      </div>
      <div className="ez-hrow justify-end">
        <AdminInfoHint label="Overview" info={MARKETPLACE_CHART_INFO.overview} />
      </div>
      {secondary.length > 0 ? (
        <p className="ez-small">{secondary.join(" · ")}</p>
      ) : null}

      {data.by_category.length > 0 ? (
        <Card as="section">
          <Card.Header>
            <h2 className="ez-h3">Category performance and recruitment opportunities</h2>
          </Card.Header>
          <DataTable
            aria-label="Category performance"
            embedded
            rows={data.by_category}
            getRowKey={(row) => row.key}
            columns={[
              { key: "category", header: "Category", kind: "strong", cell: (row) => row.key },
              { key: "enquiries", header: "Enquiries", kind: "num", className: "tabular-nums", cell: (row) => row.enquiries },
              { key: "completed", header: "Completed", kind: "num", className: "tabular-nums", cell: (row) => row.completed },
              {
                key: "conversion",
                header: "Conversion",
                kind: "num",
                className: "tabular-nums",
                cell: (row) => formatMarketplacePct(row.conversion_rate),
              },
              {
                key: "revenue",
                header: "Revenue",
                kind: "num",
                className: "tabular-nums",
                cell: (row) => formatGbp(row.revenue_gbp, { decimals: 0, grouping: false }),
              },
              {
                key: "supply",
                header: "Supply",
                cell: (row) =>
                  recruitCategoryKeys.has(row.key.toLowerCase()) ? (
                    <Badge tone="warning">Recruit more</Badge>
                  ) : (
                    <Badge tone="success">Well supplied</Badge>
                  ),
              },
            ]}
          />
          <TablePagination
            offset={categoryOffset}
            limit={ADMIN_TABLE_PAGE_SIZE}
            total={data.by_category_total}
            pageRowCount={data.by_category.length}
            onPrevious={() =>
              setCategoryOffset((current) => Math.max(0, current - ADMIN_TABLE_PAGE_SIZE))
            }
            onNext={() => setCategoryOffset((current) => current + ADMIN_TABLE_PAGE_SIZE)}
          />
          {recruitHints.length > 0 ? (
            <Card.Body>
              <ul className="ez-stack ez-stack--sm">
                {recruitHints.map((message) => (
                  <li key={message} className="ez-small">
                    {message}
                  </li>
                ))}
              </ul>
            </Card.Body>
          ) : null}
        </Card>
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
              <p className="flex h-[180px] items-center justify-center text-sm text-ink-3">
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
              <p className="flex h-[180px] items-center justify-center text-sm text-ink-3">
                No failures recorded.
              </p>
            )}
          </AdminChartCard>

          <RankedListCard
            title="Top locations"
            subtitle="By enquiry volume"
            info={MARKETPLACE_CHART_INFO.locations}
            emptyMessage="No location data in this period."
            rows={locations.map((location) => ({
              key: location.key,
              title: location.key,
              trailing: (
                <p className="text-xs tabular-nums text-ink-3">
                  <span className="font-medium text-ink">{location.enquiries}</span>
                  <span className="mx-1 text-ink-3">·</span>
                  {formatMarketplacePct(location.conversion_rate)}
                </p>
              ),
            }))}
          />

          <RankedListCard
            title="Top vendors"
            subtitle="Completed bookings & revenue"
            info={MARKETPLACE_CHART_INFO.vendors}
            emptyMessage="No vendor data in this period."
            rows={vendors.map((vendor) => ({
              key: vendor.vendor_user_id,
              title: vendor.business_name,
              subtitle: `${vendor.completed} completed · ${formatMarketplaceSeconds(vendor.avg_response_seconds)}`,
              trailing: (
                <>
                  <p className="text-sm font-medium tabular-nums text-ink">
                    {formatGbp(vendor.revenue_gbp, { decimals: 0, grouping: false })}
                  </p>
                  <p className="text-xs tabular-nums text-ink-3">
                    {formatMarketplacePct(vendor.conversion_rate)}
                  </p>
                </>
              ),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
