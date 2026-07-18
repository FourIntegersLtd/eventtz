"use client";

import { useCallback, useEffect, useState } from "react";
import { PoundSterling, Receipt, ShoppingBag } from "lucide-react";
import {
  fetchAdminFinancials,
  type AdminFinancialsSummary,
} from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminCommercePeriodFilter } from "@/features/admin/components/AdminCommercePeriodFilter";
import { AdminFinancialsCharts } from "@/features/admin/financials/AdminFinancialsCharts";
import {
  commercePeriodRange,
  type CommercePeriodDays,
} from "@/features/admin/commerce/commercePeriod";

function formatGbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AdminFinancialsView() {
  const [period, setPeriod] = useState<CommercePeriodDays>(30);
  const [range, setRange] = useState(() => commercePeriodRange(30));
  const [summary, setSummary] = useState<AdminFinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePeriodChange = useCallback((next: CommercePeriodDays) => {
    setPeriod(next);
    setRange(commercePeriodRange(next));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await fetchAdminFinancials(range.from, range.to);
      setSummary(s);
    } catch {
      setError("Could not load financials.");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="flex justify-end">
        <AdminCommercePeriodFilter period={period} onPeriodChange={handlePeriodChange} />
      </div>

      {loading ? (
        <AdminLoadingState />
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminKpiCard
              label="Client spend"
              value={formatGbp(summary.gmv_gbp)}
              hint="Total paid by clients"
              icon={PoundSterling}
              tone="primary"
            />
            <AdminKpiCard
              label="Platform fee"
              value={formatGbp(summary.platform_fee_gbp)}
              hint={`${summary.service_fee_percent}% service fee on paid bookings`}
              icon={Receipt}
              tone="success"
            />
            <AdminKpiCard
              label="Paid bookings"
              value={summary.paid_booking_count}
              icon={ShoppingBag}
              tone="info"
            />
          </div>

          <AdminFinancialsCharts summary={summary} />
        </>
      ) : null}
    </div>
  );
}
