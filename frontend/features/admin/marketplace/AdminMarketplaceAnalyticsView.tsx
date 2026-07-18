"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Inbox,
  MapPin,
  Percent,
  Users,
} from "lucide-react";
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
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
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
  const demandSeries = toMarketplaceDemandSeries(data.enquiries_by_month);
  const completedSeries = toMarketplaceCompletedSeries(data.completed_by_month);
  const categoryBars = toMarketplaceCategoryBars(data.by_category);
  const failureDonut = data.failure_reasons.map((r) => ({
    name: r.reason.replace(/_/g, " ").toLowerCase(),
    value: r.count,
  }));
  const locations = data.by_location.slice(0, 8);
  const vendors = data.top_vendors.slice(0, 8);
  const hasRecruitHints =
    data.recruitment_hints.categories.length > 0 || data.recruitment_hints.locations.length > 0;

  return (
    <div className="space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="flex justify-end">
        <AdminCommercePeriodFilter period={period} onPeriodChange={handlePeriodChange} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminKpiCard
          label="Enquiries"
          value={kpis.enquiries}
          hint={`${kpis.vendorsActive} active vendors`}
          icon={Inbox}
          tone="primary"
        />
        <AdminKpiCard
          label="Conversion"
          value={formatMarketplacePct(kpis.overallConversion)}
          hint={`Avg response ${formatMarketplaceSeconds(kpis.avgResponseSeconds)}`}
          icon={Percent}
          tone="info"
        />
        <AdminKpiCard
          label="Completed"
          value={kpis.completed}
          hint={`Avg ${formatMarketplaceMoney(kpis.avgBookingValue)}`}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminKpiCard
          label="Reply under 1h"
          value={formatMarketplacePct(kpis.replyWithin1h)}
          hint={`${formatMarketplacePct(kpis.replyWithin6h)} within 6h · ${formatMarketplacePct(kpis.replyWithin24h)} within 24h`}
          icon={Percent}
          tone="info"
        />
        <AdminKpiCard
          label="Vendor nudges"
          value={kpis.vendorReminders}
          hint={`${kpis.clientNudges} client “try others” emails`}
          icon={Inbox}
          tone="primary"
        />
        <AdminKpiCard
          label="Multi-enquire"
          value={kpis.multiBatches}
          hint="Batches of 2+ vendors in one send"
          icon={Users}
          tone="success"
        />
      </div>

      {hasRecruitHints ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-semibold">Recruit more vendors</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.recruitment_hints.categories.map((h) => (
              <li key={h.category}>{h.message}</li>
            ))}
            {data.recruitment_hints.locations.map((h) => (
              <li key={h.location}>{h.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Column layout: trends left, breakdowns right */}
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
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Top locations</h2>
                  <p className="text-xs text-neutral-500">By enquiry volume</p>
                </div>
              </div>
              <AdminInfoHint label="Top locations" info={MARKETPLACE_CHART_INFO.locations} />
            </div>
            {locations.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">
                No location data in this period.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {locations.map((r, i) => (
                  <li
                    key={r.key}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-neutral-900">{r.key}</span>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums text-neutral-600">
                      <span className="font-semibold text-neutral-900">{r.enquiries}</span>
                      <span className="mx-1 text-neutral-300">·</span>
                      {formatMarketplacePct(r.conversion_rate)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${adminCard} overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Top vendors</h2>
                  <p className="text-xs text-neutral-500">Completed bookings & revenue</p>
                </div>
              </div>
              <AdminInfoHint label="Top vendors" info={MARKETPLACE_CHART_INFO.vendors} />
            </div>
            {vendors.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">
                No vendor data in this period.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {vendors.map((v, i) => (
                  <li
                    key={v.vendor_user_id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900">{v.business_name}</p>
                        <p className="text-xs text-neutral-500">
                          {v.completed} completed · {formatMarketplaceSeconds(v.avg_response_seconds)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-neutral-900">
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
