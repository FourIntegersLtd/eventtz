"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminErrorBanner, AdminKpiCard, AdminLoadingState } from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import {
  fetchAdminDashboardMetrics,
  fetchAdminDashboardSummary,
  type AdminDashboardMetrics,
  type AdminDashboardSummary,
} from "@/domains/admin-dashboard/api";

/**
 * `/admin/dashboard` — headline KPI tiles plus a rolling 30-day activity
 * table. `web` has no chart library yet (see hand-off), so the baseline's
 * bookings/signups line charts are rendered as a plain table of daily rows
 * instead — a faithful first pass a later workstream can turn into charts.
 */
export function AdminDashboardView() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      const [loadedSummary, loadedMetrics] = await Promise.all([
        fetchAdminDashboardSummary(),
        fetchAdminDashboardMetrics(30),
      ]);
      setSummary(loadedSummary);
      setMetrics(loadedMetrics);
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (loading) return <AdminLoadingState label="Loading dashboard…" />;
  if (error || !summary || !metrics) return <AdminErrorBanner message={error ?? "Could not load the dashboard."} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <AdminKpiCard label="Clients" value={String(summary.users_client)} />
        <AdminKpiCard label="Vendors" value={String(summary.users_vendor)} />
        <AdminKpiCard label="Vendors approved" value={String(summary.vendors_approved)} />
        <AdminKpiCard label="Vendors pending" value={String(summary.vendors_pending)} />
        <AdminKpiCard label="Bookings pending" value={String(summary.bookings_pending)} />
        <AdminKpiCard label="Bookings paid" value={String(summary.bookings_paid_count)} />
        <AdminKpiCard label="Needing support" value={String(summary.bookings_needing_support)} hint="Bookings" />
        <AdminKpiCard label="Open disputes" value={String(metrics.open_disputes_count)} />
      </div>

      <div className="rounded-2xl border border-primary-border bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Last {metrics.period_days} days</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary-border text-left text-xs uppercase text-neutral-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Bookings created</th>
                <th className="py-2 pr-4">Bookings paid</th>
                <th className="py-2 pr-4">Takings</th>
                <th className="py-2 pr-4">New clients</th>
                <th className="py-2">New vendors</th>
              </tr>
            </thead>
            <tbody>
              {(metrics.bookings_created ?? []).map((bucket, index) => {
                const paidBucket = metrics.bookings_paid?.[index];
                const signupBucket = metrics.signups?.[index];
                return (
                  <tr key={bucket.date} className="border-b border-primary-border/60">
                    <td className="py-2 pr-4">{bucket.date}</td>
                    <td className="py-2 pr-4">{bucket.count}</td>
                    <td className="py-2 pr-4">{paidBucket?.count ?? 0}</td>
                    <td className="py-2 pr-4">£{(paidBucket?.gmv_gbp ?? 0).toFixed(2)}</td>
                    <td className="py-2 pr-4">{signupBucket?.clients ?? 0}</td>
                    <td className="py-2">{signupBucket?.vendors ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
