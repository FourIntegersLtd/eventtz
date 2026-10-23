"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminAttentionList, type AdminAttentionItem } from "@/features/admin/components/AdminAttentionList";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { AdminDashboardCharts } from "@/features/admin/dashboard/AdminDashboardCharts";
import { useAdminDashboard } from "@/features/admin/dashboard/useAdminDashboard";
import { useAdminDashboardMetrics } from "@/features/admin/dashboard/useAdminDashboardMetrics";
import { commercePeriodRange, type AdminPeriodDays } from "@/lib/commercePeriod";
import { fetchAdminFinancials, type AdminFinancialsSummary } from "@/lib/adminPlatformApi";
import { formatGbp } from "@/lib/money";
import { formatDate } from "@/lib/dateFormat";

function DashboardSkeleton() {
  return (
    <div className="ez-stack ez-stack--lg">
      <LoadingState label="Loading dashboard…" variant="centered" className="py-2" />
      <div className="ez-grid-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export function adminDashboardTodayLine(): string {
  const when = formatDate(new Date(), "weekdayDayMonthYear");
  return `${when} · what needs you today`;
}

type AdminDashboardViewProps = {
  period: AdminPeriodDays;
};

export function AdminDashboardView({ period }: AdminDashboardViewProps) {
  const { summary, loading, error } = useAdminDashboard();
  const {
    metrics: metricsForAttention,
    loading: metricsLoading,
    error: metricsError,
  } = useAdminDashboardMetrics(period);

  const [financials, setFinancials] = useState<AdminFinancialsSummary | null>(null);
  const [financialsLoading, setFinancialsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const range = commercePeriodRange(period);
    setFinancialsLoading(true);
    void fetchAdminFinancials(range.from, range.to)
      .then((summaryFinancials) => {
        if (!cancelled) setFinancials(summaryFinancials);
      })
      .catch(() => {
        if (!cancelled) setFinancials(null);
      })
      .finally(() => {
        if (!cancelled) setFinancialsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const attentionItems = useMemo((): AdminAttentionItem[] => {
    if (!summary) return [];
    const items: AdminAttentionItem[] = [];
    const openDisputes = metricsForAttention?.open_disputes_count ?? 0;

    if (summary.vendors_pending > 0) {
      items.push({
        id: "vendors-pending",
        title: "Vendor approvals",
        subtitle: `${summary.vendors_pending} waiting for review`,
        badge: `${summary.vendors_pending} pending`,
        href: "/admin/directory?tab=vendors",
        tone: "urgent",
      });
    }
    if (openDisputes > 0) {
      items.push({
        id: "disputes-open",
        title: "Open disputes",
        subtitle: "Funds stay held until a decision is recorded",
        badge: `${openDisputes} open`,
        href: "/admin/trust?tab=disputes",
        tone: "urgent",
      });
    }
    const bookingsNeedingSupport = summary.bookings_needing_support ?? 0;
    if (bookingsNeedingSupport > 0) {
      items.push({
        id: "bookings-support",
        title: "Bookings needing support",
        badge: `${bookingsNeedingSupport} open`,
        href: "/admin/commerce?tab=bookings&needs_attention=1",
        tone: "urgent",
      });
    }
    if (summary.bookings_pending > 0) {
      items.push({
        id: "bookings-pending",
        title: "Bookings awaiting a vendor",
        badge: `${summary.bookings_pending} pending`,
        href: "/admin/commerce?tab=bookings&status=pending",
        tone: "info",
      });
    }
    if (summary.conversations_count > 0) {
      items.push({
        id: "messages",
        title: "Support threads",
        subtitle: `${summary.conversations_count} conversation${summary.conversations_count === 1 ? "" : "s"} on file`,
        href: "/admin/messages?tab=inbox",
        tone: "info",
      });
    }
    return items;
  }, [summary, metricsForAttention?.open_disputes_count]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!summary || error) {
    return <AdminErrorBanner message={error ?? "Could not load dashboard."} />;
  }

  const periodGmv = (metricsForAttention?.bookings_paid ?? []).reduce((sum, bucket) => sum + bucket.gmv_gbp, 0);
  const activeBookings = summary.bookings_pending + summary.bookings_accepted;
  const platformFeesLabel = financialsLoading
    ? "…"
    : formatGbp(financials?.platform_fee_gbp ?? 0, { prefix: "" });

  return (
    <div className="ez-stack ez-stack--lg">
      <div className="ez-grid-4">
        <AdminKpiCard label="Gross booking value" value={formatGbp(periodGmv, { prefix: "" })} />
        <AdminKpiCard label="Platform fees" value={platformFeesLabel} />
        <AdminKpiCard
          label="Active bookings"
          value={activeBookings}
          href="/admin/commerce?tab=bookings"
        />
        <AdminKpiCard
          label="Paid bookings"
          value={summary.bookings_paid_count}
          href="/admin/commerce?tab=financials"
        />
      </div>

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <AdminAttentionList
            title="Needs action"
            subtitle="Queues that still need a person"
            items={attentionItems}
            emptyTitle="Nothing waiting"
          />
        </div>
      </div>

      <AdminDashboardCharts
        summary={summary}
        metrics={metricsForAttention}
        loading={metricsLoading}
        error={metricsError}
      />
    </div>
  );
}
