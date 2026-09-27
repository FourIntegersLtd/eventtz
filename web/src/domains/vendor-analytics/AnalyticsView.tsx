"use client";

import { useEffect, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Card, LoadingState } from "@/foundation/ui";
import { CopilotPanel } from "@/capabilities/vendor-copilot-panel/CopilotPanel";
import { fetchVendorAnalytics, type VendorAnalytics } from "@/domains/vendor-analytics/api";
import { formatMoneyGbp, formatPercent, formatSecondsDuration, toMonthSeries } from "@/domains/vendor-analytics/analyticsFormat";
import { BarChart } from "@/domains/vendor-analytics/BarChart";

/** One headline KPI tile: a label and a big value. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="lg">
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-neutral-900">{value}</p>
    </Card>
  );
}

/** One funnel stage row: a label and its count, for the simple text funnel below the charts. */
function FunnelRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-neutral-700">{label}</span>
      <span className="font-semibold text-neutral-900">{count}</span>
    </li>
  );
}

/**
 * The vendor analytics page: headline KPIs, monthly trend charts, a
 * conversion funnel, and the growth co-pilot (shown here too, per the
 * baseline's dashboard — see this workstream's hand-off note).
 *
 * Ported (simplified) from the baseline's `VendorAnalyticsView`: the
 * baseline draws its charts with a charting library this rebuild does not
 * depend on, so the trend charts here are hand-rolled CSS bars instead
 * (see `BarChart.tsx`).
 */
export function AnalyticsView() {
  const [analytics, setAnalytics] = useState<VendorAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchVendorAnalytics(90);
        if (!cancelled) setAnalytics(result);
      } catch (cause: unknown) {
        if (!cancelled) setError(platformErrorDetail(cause) ?? "Could not load your analytics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState variant="inline" label="Loading your analytics…" />;
  }

  if (error || !analytics) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">{error ?? "No analytics available."}</p>;
  }

  const { overview, funnel } = analytics;

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Enquiries" value={String(overview.enquiries ?? 0)} />
        <StatTile label="Conversion rate" value={formatPercent(overview.conversion_rate)} />
        <StatTile label="Completed" value={String(overview.completed ?? 0)} />
        <StatTile label="Revenue" value={formatMoneyGbp(overview.revenue_gbp)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <Card padding="lg">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">Enquiries by month</h2>
            <div className="mt-4">
              <BarChart bars={toMonthSeries(analytics.enquiries_by_month, "count")} valueLabel="Enquiries" />
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">Revenue by month</h2>
            <div className="mt-4">
              <BarChart bars={toMonthSeries(analytics.revenue_by_month, "revenue_gbp")} valueLabel="Revenue" formatValue={formatMoneyGbp} />
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">Average response time</h2>
            <p className="mt-1 text-sm text-neutral-500">Typical time from {"an enquiry landing to your first reply."}</p>
            <div className="mt-4">
              <BarChart
                bars={toMonthSeries(analytics.response_time_by_month, "avg_seconds")}
                valueLabel="Average response time"
                formatValue={formatSecondsDuration}
              />
            </div>
            <p className="mt-2 text-sm text-neutral-600">Overall: {formatSecondsDuration(overview.avg_response_seconds)}</p>
          </Card>

          <Card padding="lg">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">Enquiry-to-booking funnel</h2>
            <ul className="mt-2 divide-y divide-neutral-100">
              <FunnelRow label="Profile views" count={funnel.profile_views} />
              <FunnelRow label="Enquiries" count={funnel.enquiries} />
              <FunnelRow label="Accepted" count={funnel.accepted} />
              <FunnelRow label="Paid" count={funnel.paid} />
              <FunnelRow label="Completed" count={funnel.completed} />
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <CopilotPanel />
        </div>
      </div>
    </div>
  );
}
