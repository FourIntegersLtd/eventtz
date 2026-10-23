"use client";

import type { ReactNode } from "react";
import type { VendorAnalytics } from "@/lib/vendorAnalyticsApi";
import type { AdminPeriodDays } from "@/lib/commercePeriod";
import { EzAreaChart } from "@/components/charts/EzAreaChart";
import { EzBarChart } from "@/components/charts/EzBarChart";
import { EzDonutChart } from "@/components/charts/EzDonutChart";
import { chartHasData } from "@/components/charts/chartUtils";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  formatVendorPct,
  formatVendorSeconds,
  toVendorMonthSeries,
  vendorFunnelDonut,
  vendorOverviewKpis,
  VENDOR_ANALYTICS_PERIOD_OPTIONS,
} from "@/features/vendor/analytics/vendorAnalyticsModel";
import { EzPeriodFilterButton } from "@/components/ui/EzPeriodFilterButton";
import { formatCount, formatGbp } from "@/lib/money";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";

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
      <PageHeader descriptionSize="body"
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
          <span className="ez-kpi__value">{formatCount(kpis.enquiries)}</span>
          <span className="ez-caption">{kpis.pending} pending</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">Conversion</span>
          <span className="ez-kpi__value">{formatVendorPct(kpis.conversion)}</span>
          <span className="ez-caption">Avg response {formatVendorSeconds(kpis.avgResponseSeconds)}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">Completed</span>
          <span className="ez-kpi__value">{formatCount(kpis.completed)}</span>
          <span className="ez-caption">{formatGbp(kpis.revenue, { decimals: 0 })} revenue</span>
        </div>
      </div>

      <div className="ez-grid-2">
        <div className="ez-stack ez-stack--lg">
          <ChartCard title="Enquiries over time" subtitle="New requests per month">
            {chartHasData(enquirySeries.map((point) => point.value)) ? (
              <EzBarChart data={enquirySeries} valueLabel="Enquiries" color="var(--ez-chart-1)" />
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
              <EzAreaChart data={revenueSeries} valueLabel="Revenue" />
            ) : (
              <EmptyState className="border-0" variant="payments" title="No revenue in this period" />
            )}
          </ChartCard>
          <ChartCard title="Customer rating" subtitle="Average score out of 5">
            {chartHasData(ratingSeries.map((point) => point.value)) ? (
              <EzBarChart data={ratingSeries} valueLabel="Avg rating" color="var(--ez-chart-3)" />
            ) : (
              <EmptyState className="border-0" lottie="reviews" title="No ratings yet" />
            )}
          </ChartCard>
        </div>
        <div className="ez-stack ez-stack--lg">
          <ChartCard title="Booking funnel" subtitle="From profile views to completed">
            {funnelTotal > 0 ? (
              <EzDonutChart data={funnel} />
            ) : (
              <EmptyState className="border-0" lottie="searchNoResults" title="No funnel activity yet" />
            )}
          </ChartCard>
          <ChartCard title="Response time" subtitle="Average reply time (hours)">
            {chartHasData(responseSeries.map((point) => point.value)) ? (
              <EzBarChart data={responseSeries} valueLabel="Hours" color="var(--ez-chart-2)" />
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
    <Card>
      <Card.Header>
        <div>
          <span className="ez-h3">{title}</span>
          <p className="ez-caption">{subtitle}</p>
        </div>
      </Card.Header>
      <Card.Body>{children}</Card.Body>
      {footerHref && footerLabel ? (
        <Card.Footer>
          <ButtonLink variant="ghost" href={footerHref}>
            {footerLabel}
          </ButtonLink>
        </Card.Footer>
      ) : null}
    </Card>
  );
}
