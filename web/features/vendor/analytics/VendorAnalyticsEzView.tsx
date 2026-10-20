"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { VendorAnalytics } from "@/lib/vendorAnalyticsApi";
import type { AdminPeriodDays } from "@/features/admin/commerce/commercePeriod";
import { AdminAreaChart } from "@/features/admin/components/AdminAreaChart";
import { AdminBarChart } from "@/features/admin/components/AdminBarChart";
import { AdminDonutChart } from "@/features/admin/components/AdminDonutChart";
import { chartHasData } from "@/features/admin/components/chartUtils";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorEzPageHead } from "@/features/vendor/ui/VendorEzPageHead";
import {
  formatVendorMoney,
  formatVendorPct,
  formatVendorSeconds,
  toVendorMonthSeries,
  vendorFunnelDonut,
  vendorOverviewKpis,
  VENDOR_ANALYTICS_PERIOD_OPTIONS,
} from "@/features/vendor/analytics/vendorAnalyticsModel";
import { EzPeriodFilterButton } from "@/components/ui/EzPeriodFilterButton";

type VendorAnalyticsEzViewProps = {
  data: VendorAnalytics;
  period: AdminPeriodDays;
  onPeriodChange: (days: AdminPeriodDays) => void;
  businessName?: string | null;
};

/** Live vendor analytics: the existing charts, in the shared ez cards. */
export function VendorAnalyticsEzView({
  data,
  period,
  onPeriodChange,
  businessName,
}: VendorAnalyticsEzViewProps) {
  const kpis = vendorOverviewKpis(data.overview);
  const enquirySeries = toVendorMonthSeries(data.enquiries_by_month, "count");
  const revenueSeries = toVendorMonthSeries(data.revenue_by_month, "revenue_gbp");
  const responseSeries = toVendorMonthSeries(data.response_time_by_month, "avg_seconds", 3600);
  const ratingSeries = toVendorMonthSeries(data.rating_by_month, "avg_rating");
  const funnel = vendorFunnelDonut(data.funnel);
  const funnelTotal = funnel.reduce((sum, slice) => sum + slice.value, 0);
  const description = businessName
    ? `How clients find and choose ${businessName}.`
    : "How clients find and book you on Eventtz.";

  return (
    <div className="ez-stack ez-stack--lg">
      <VendorEzPageHead
        eyebrow="Insights"
        title="Analytics"
        description={description}
        actions={
          <EzPeriodFilterButton
            options={VENDOR_ANALYTICS_PERIOD_OPTIONS}
            value={period}
            onChange={onPeriodChange}
            defaultValue={30}
          />
        }
      />

      <div className="ez-grid-3">
        <div className="ez-kpi">
          <span className="ez-kpi__label">Enquiries</span>
          <span className="ez-kpi__value">{kpis.enquiries.toLocaleString("en-GB")}</span>
          <span className="ez-caption">{kpis.pending} pending</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">Conversion</span>
          <span className="ez-kpi__value">{formatVendorPct(kpis.conversion)}</span>
          <span className="ez-caption">Avg response {formatVendorSeconds(kpis.avgResponseSeconds)}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">Completed</span>
          <span className="ez-kpi__value">{kpis.completed.toLocaleString("en-GB")}</span>
          <span className="ez-caption">{formatVendorMoney(kpis.revenue)} revenue</span>
        </div>
      </div>

      <div className="ez-grid-2">
        <div className="ez-stack ez-stack--lg">
          <ChartCard title="Enquiries over time" subtitle="New requests per month">
            {chartHasData(enquirySeries.map((point) => point.value)) ? (
              <AdminBarChart data={enquirySeries} valueLabel="Enquiries" color="var(--color-primary, #3e1964)" />
            ) : (
              <EmptyState className="border-0" lottie="emptyCalendar" title="No enquiries in this period" />
            )}
          </ChartCard>
          <ChartCard
            title="Revenue over time"
            subtitle="Paid booking totals per month"
            footerHref="/vendor/bookings"
            footerLabel="View bookings →"
          >
            {chartHasData(revenueSeries.map((point) => point.value)) ? (
              <AdminAreaChart data={revenueSeries} valueLabel="Revenue" />
            ) : (
              <EmptyState className="border-0" variant="payments" title="No revenue in this period" />
            )}
          </ChartCard>
          <ChartCard title="Customer rating" subtitle="Average score out of 5">
            {chartHasData(ratingSeries.map((point) => point.value)) ? (
              <AdminBarChart data={ratingSeries} valueLabel="Avg rating" color="#10b981" />
            ) : (
              <EmptyState className="border-0" lottie="reviews" title="No ratings yet" />
            )}
          </ChartCard>
        </div>
        <div className="ez-stack ez-stack--lg">
          <ChartCard title="Booking funnel" subtitle="From profile views to completed">
            {funnelTotal > 0 ? (
              <AdminDonutChart data={funnel} />
            ) : (
              <EmptyState className="border-0" lottie="searchNoResults" title="No funnel activity yet" />
            )}
          </ChartCard>
          <ChartCard title="Response time" subtitle="Average reply time (hours)">
            {chartHasData(responseSeries.map((point) => point.value)) ? (
              <AdminBarChart data={responseSeries} valueLabel="Hours" color="#f59e0b" />
            ) : (
              <EmptyState className="border-0" lottie="pendingReview" title="No response data yet" />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  footerHref,
  footerLabel,
  children,
}: {
  title: string;
  subtitle: string;
  footerHref?: string;
  footerLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="ez-card">
      <div className="ez-card__head">
        <div>
          <span className="ez-h3">{title}</span>
          <p className="ez-caption">{subtitle}</p>
        </div>
      </div>
      <div className="ez-card__body">{children}</div>
      {footerHref && footerLabel ? (
        <div className="ez-card__foot">
          <Link className="ez-btn ez-btn--ghost" href={footerHref}>
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
