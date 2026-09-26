"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { AdminErrorBanner, AdminKpiCard, AdminLoadingState, formatGbp, isSuperAdmin } from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { downloadAdminFinancialsCsv, fetchAdminFinancials, type AdminFinancialsSummary } from "@/domains/admin-commerce/api";

/** Commerce's Financials tab: takings, platform fee and payout status over a period. */
export function AdminFinancialsView() {
  const { session } = useSession();
  const [summary, setSummary] = useState<AdminFinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      setSummary(await fetchAdminFinancials());
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load financials.");
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

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadAdminFinancialsCsv();
    } catch {
      setExportError("Could not export the CSV. Try again.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <AdminLoadingState label="Loading financials…" />;
  if (error || !summary) return <AdminErrorBanner message={error ?? "Could not load financials."} />;

  return (
    <div className="space-y-4">
      {isSuperAdmin(session) ? (
        <div className="flex justify-end">
          <Button variant="secondary" loading={exporting} onClick={() => void handleExport()}>
            Export CSV
          </Button>
        </div>
      ) : null}
      {exportError ? <AdminErrorBanner message={exportError} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminKpiCard label="Client spend" value={formatGbp(summary.gmv_gbp)} hint="Total paid by clients" />
        <AdminKpiCard
          label="Platform fee"
          value={formatGbp(summary.platform_fee_gbp)}
          hint={`${summary.service_fee_percent}% service fee on paid bookings`}
        />
        <AdminKpiCard label="Paid bookings" value={String(summary.paid_booking_count)} />
        <AdminKpiCard label="Payout released" value={formatGbp(summary.payout_released_gbp)} />
        <AdminKpiCard label="Held in platform balance" value={formatGbp(summary.held_in_platform_balance_gbp)} />
        <AdminKpiCard label="Vendor portion" value={formatGbp(summary.vendor_portion_gbp)} />
      </div>
      <p className="text-xs text-neutral-500">{summary.disclaimer}</p>
    </div>
  );
}
