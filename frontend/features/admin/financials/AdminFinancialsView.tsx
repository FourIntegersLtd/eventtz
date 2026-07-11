"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Download, Receipt, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  downloadAdminFinancialsCsv,
  fetchAdminFinancials,
  type AdminFinancialsSummary,
} from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminFinancialsCharts } from "@/features/admin/financials/AdminFinancialsCharts";

function presetRange(preset: "30d" | "month"): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === "30d") {
    from.setDate(from.getDate() - 30);
  } else {
    from.setDate(1);
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function formatGbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AdminFinancialsView() {
  const defaultRange = presetRange("30d");
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [summary, setSummary] = useState<AdminFinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

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
    <div className="space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}

      <AdminPageHeader />

      <AdminFilterBar>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const { from: f, to: t } = presetRange("30d");
              setFrom(f);
              setTo(t);
            }}
          >
            Last 30 days
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const { from: f, to: t } = presetRange("month");
              setFrom(f);
              setTo(t);
            }}
          >
            This month
          </Button>
        </div>
        <label className="text-sm">
          <span className="text-neutral-600">Paid from</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-600">Paid to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Apply
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="h-4 w-4" aria-hidden />}
          loading={csvBusy}
          onClick={async () => {
            setCsvBusy(true);
            try {
              await downloadAdminFinancialsCsv(from || undefined, to || undefined);
            } finally {
              setCsvBusy(false);
            }
          }}
        >
          Export CSV
        </Button>
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState />
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminKpiCard
              label="GMV"
              value={formatGbp(summary.gmv_gbp)}
              icon={Banknote}
              tone="primary"
            />
            <AdminKpiCard
              label="Platform fee"
              value={formatGbp(summary.platform_fee_gbp)}
              hint={`${summary.service_fee_percent}% service fee`}
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

          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-600">
            <span>
              Vendor portion{" "}
              <span className="font-medium tabular-nums text-neutral-900">
                {formatGbp(summary.vendor_portion_gbp)}
              </span>
            </span>
            <span>
              Paid out{" "}
              <span className="font-medium tabular-nums text-neutral-900">
                {formatGbp(summary.payout_released_gbp)}
              </span>
            </span>
            <span>
              Held in balance{" "}
              <span className="font-medium tabular-nums text-neutral-900">
                {formatGbp(summary.held_in_platform_balance_gbp)}
              </span>
            </span>
          </p>

          <AdminFinancialsCharts summary={summary} />
        </>
      ) : null}
    </div>
  );
}
