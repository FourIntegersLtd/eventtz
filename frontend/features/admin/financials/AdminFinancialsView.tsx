"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt, ShoppingBag } from "lucide-react";
import {
  downloadAdminFinancialsCsv,
  fetchAdminFinancials,
  type AdminFinancialsSummary,
} from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminFinancialsCharts } from "@/features/admin/financials/AdminFinancialsCharts";
import {
  AdminFinancialsPeriodControl,
  financialsPeriodRange,
  type FinancialsPeriod,
} from "@/features/admin/financials/AdminFinancialsToolbar";

function formatGbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AdminFinancialsView() {
  const [period, setPeriod] = useState<FinancialsPeriod>("30d");
  const [from, setFrom] = useState(() => financialsPeriodRange("30d").from);
  const [to, setTo] = useState(() => financialsPeriodRange("30d").to);
  const [summary, setSummary] = useState<AdminFinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  const handlePeriodChange = useCallback((next: FinancialsPeriod) => {
    setPeriod(next);
    const range = financialsPeriodRange(next);
    setFrom(range.from);
    setTo(range.to);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await fetchAdminFinancials(from || undefined, to || undefined);
      setSummary(s);
    } catch {
      setError("Could not load financials.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="flex justify-end">
        <AdminFinancialsPeriodControl
          period={period}
          csvBusy={csvBusy}
          onPeriodChange={handlePeriodChange}
          onExportCsv={() => {
            setCsvBusy(true);
            void downloadAdminFinancialsCsv(from || undefined, to || undefined).finally(() => {
              setCsvBusy(false);
            });
          }}
        />
      </div>

      {loading ? (
        <AdminLoadingState />
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
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
