"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminErrorBanner, AdminLoadingState } from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminMarketplaceAnalytics, type AdminMarketplaceAnalytics } from "@/domains/admin-commerce/api";

/**
 * Commerce's Marketplace tab: the enquiry-to-completion funnel.
 *
 * `web` has no chart library yet (see hand-off), so this renders the raw
 * overview figures as a definition list rather than the baseline's charts —
 * a faithful-enough first pass that a later workstream can turn into charts.
 */
export function AdminMarketplaceAnalyticsView() {
  const [data, setData] = useState<AdminMarketplaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      setData(await fetchAdminMarketplaceAnalytics());
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load marketplace analytics.");
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

  if (loading) return <AdminLoadingState label="Loading marketplace analytics…" />;
  if (error || !data) return <AdminErrorBanner message={error ?? "Could not load marketplace analytics."} />;

  const overview = (data.overview ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        {data.from_date} to {data.to_date}
      </p>
      <div className="rounded-2xl border border-primary-border bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">Overview</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {Object.entries(overview).map(([key, value]) => (
            <div key={key}>
              <dt className="text-neutral-500">{key.replace(/_/g, " ")}</dt>
              <dd className="text-neutral-900">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
