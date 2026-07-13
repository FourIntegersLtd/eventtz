"use client";

import { useMemo } from "react";
import {
  CalendarDays,
  MessageCircle,
  Store,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminAttentionList, type AdminAttentionItem } from "@/features/admin/components/AdminAttentionList";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminDashboardCharts } from "@/features/admin/dashboard/AdminDashboardCharts";
import { useAdminDashboard } from "@/features/admin/dashboard/useAdminDashboard";
import { useAdminDashboardMetrics } from "@/features/admin/dashboard/useAdminDashboardMetrics";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingState label="Loading dashboard…" variant="centered" className="py-2" />
      <div className="flex justify-end">
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardView() {
  const { summary, loading, error, reload } = useAdminDashboard();
  const { metrics: metricsForAttention } = useAdminDashboardMetrics(30);

  const attentionItems = useMemo((): AdminAttentionItem[] => {
    if (!summary) return [];
    const items: AdminAttentionItem[] = [];
    const openDisputes = metricsForAttention?.open_disputes_count ?? 0;

    if (summary.vendors_pending > 0) {
      items.push({
        id: "vendors-pending",
        title: `Review ${summary.vendors_pending} vendor application${summary.vendors_pending === 1 ? "" : "s"}`,
        href: "/admin/directory?tab=vendors",
        ctaLabel: "Review",
        tone: "urgent",
      });
    }
    if (openDisputes > 0) {
      items.push({
        id: "disputes-open",
        title: `${openDisputes} open dispute${openDisputes === 1 ? "" : "s"} need attention`,
        href: "/admin/trust?tab=disputes",
        ctaLabel: "Review",
        tone: "urgent",
      });
    }
    const bookingsNeedingSupport = summary.bookings_needing_support ?? 0;

    if (bookingsNeedingSupport > 0) {
      items.push({
        id: "bookings-support",
        title: `${bookingsNeedingSupport} booking${bookingsNeedingSupport === 1 ? "" : "s"} need a support action`,
        href: "/admin/commerce?tab=bookings&needs_attention=1",
        ctaLabel: "View",
        tone: "urgent",
      });
    }
    if (summary.bookings_pending > 0) {
      items.push({
        id: "bookings-pending",
        title: `${summary.bookings_pending} booking${summary.bookings_pending === 1 ? "" : "s"} awaiting vendor response`,
        href: "/admin/commerce?tab=bookings&status=pending",
        ctaLabel: "View",
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

  const activeBookings = summary.bookings_pending + summary.bookings_accepted;
  const engagement = summary.conversations_count + summary.reviews_count;
  const bookingsNeedingSupport = summary.bookings_needing_support ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-4 w-4 text-neutral-500" aria-hidden />}
            onClick={() => void reload()}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminKpiCard
          label="Pending vendor approvals"
          value={summary.vendors_pending}
          icon={Store}
          tone="warning"
          highlight={summary.vendors_pending > 0}
          href={summary.vendors_pending > 0 ? "/admin/directory?tab=vendors" : undefined}
          linkLabel={summary.vendors_pending > 0 ? "Review in Directory" : undefined}
        />
        <AdminKpiCard
          label="Active bookings"
          value={activeBookings}
          icon={CalendarDays}
          tone={bookingsNeedingSupport > 0 ? "warning" : "info"}
          highlight={bookingsNeedingSupport > 0}
          href={
            bookingsNeedingSupport > 0
              ? "/admin/commerce?tab=bookings&needs_attention=1"
              : "/admin/commerce?tab=bookings"
          }
          linkLabel={
            bookingsNeedingSupport > 0
              ? `${bookingsNeedingSupport} need support`
              : "View bookings"
          }
        />
        <AdminKpiCard
          label="Paid bookings"
          value={summary.bookings_paid_count}
          icon={Wallet}
          tone="success"
          href="/admin/commerce?tab=financials"
          linkLabel="Financials"
        />
        <AdminKpiCard
          label="Engagement"
          value={engagement}
          icon={MessageCircle}
          tone="primary"
        />
      </div>

      <AdminAttentionList items={attentionItems} />

      <AdminDashboardCharts summary={summary} />
    </div>
  );
}
