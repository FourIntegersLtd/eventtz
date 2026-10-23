"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  downloadAdminFinancialsCsv,
  fetchAdminFinancials,
  fetchAdminFinancialsDailyPage,
  ADMIN_FINANCIALS_DAILY_PAGE_SIZE,
  type AdminFinancialsDailyBucket,
  type AdminFinancialsSummary,
} from "@/lib/adminFinancialsApi";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { StatTile } from "@/components/ui/StatTile";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { EzPeriodFilterButton } from "@/components/ui/EzPeriodFilterButton";
import { ADMIN_PERIOD_OPTIONS } from "@/lib/commercePeriod";
import { AdminFinancialsCharts } from "@/features/admin/financials/AdminFinancialsCharts";
import { DataTable } from "@/components/ui/DataTable";
import {
  commercePeriodRange,
  type CommercePeriodDays,
} from "@/lib/commercePeriod";
import { TablePagination } from "@/components/ui/TablePagination";
import { formatGbp } from "@/lib/money";

type AdminFinancialsViewProps = {
  onRegisterPageActions?: (actions: ReactNode | null) => void;
};

export function AdminFinancialsView({ onRegisterPageActions }: AdminFinancialsViewProps) {
  const [period, setPeriod] = useState<CommercePeriodDays>(30);
  const [range, setRange] = useState(() => commercePeriodRange(30));
  const [summary, setSummary] = useState<AdminFinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyOffset, setDailyOffset] = useState(0);
  const [dailyRows, setDailyRows] = useState<AdminFinancialsDailyBucket[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [dailyLoading, setDailyLoading] = useState(false);

  const handlePeriodChange = useCallback((next: CommercePeriodDays) => {
    setPeriod(next);
    setRange(commercePeriodRange(next));
    setDailyOffset(0);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const summaryResult = await fetchAdminFinancials(range.from, range.to);
      setSummary(summaryResult);
    } catch {
      setError("Could not load financials.");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!summary) return;
    setDailyLoading(true);
    void fetchAdminFinancialsDailyPage(range.from, range.to, dailyOffset, ADMIN_FINANCIALS_DAILY_PAGE_SIZE)
      .then((page) => {
        setDailyRows(page.daily);
        setDailyTotal(page.total);
      })
      .catch(() => {
        setDailyRows([]);
        setDailyTotal(0);
      })
      .finally(() => setDailyLoading(false));
  }, [summary, range.from, range.to, dailyOffset]);

  useEffect(() => {
    if (!onRegisterPageActions) return;
    onRegisterPageActions(
      <button
        type="button"
        className="ez-btn ez-btn--secondary ez-btn--sm"
        disabled={exporting}
        onClick={() => {
          setExporting(true);
          void downloadAdminFinancialsCsv(range.from, range.to)
            .catch(() => setError("Could not export financials."))
            .finally(() => setExporting(false));
        }}
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </button>,
    );
    return () => onRegisterPageActions(null);
  }, [exporting, onRegisterPageActions, range.from, range.to]);

  return (
    <div className="ez-stack ez-stack--lg min-w-0 max-w-full">
      {error ? <AdminErrorBanner message={error} /> : null}

      <EzPeriodFilterButton options={ADMIN_PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} defaultValue={30} />

      {loading ? (
        <AdminLoadingState />
      ) : summary ? (
        <>
          <div className="ez-grid-4">
            <StatTile
              label="Gross merchandise value"
              value={formatGbp(summary.gmv_gbp, { decimals: 2 })}
              hint={`${summary.paid_booking_count} paid bookings`}
            />
            <StatTile
              label="Platform fees"
              value={formatGbp(summary.platform_fee_gbp, { decimals: 2 })}
              hint={`${summary.service_fee_percent}% service fee`}
            />
            <StatTile
              label="Payouts sent"
              value={formatGbp(summary.payout_released_gbp, { decimals: 2 })}
              hint="Already transferred to vendors"
            />
            <StatTile
              label="Payouts held"
              value={formatGbp(summary.held_in_platform_balance_gbp, { decimals: 2 })}
              hint="Still with Eventtz"
            />
          </div>

          <AdminFinancialsCharts summary={summary} />

          {dailyTotal > 0 || dailyLoading ? (
            <section className="ez-card">
              <div className="ez-card__head">
                <h2 className="ez-h3">Daily totals</h2>
              </div>
              <DataTable
                aria-label="Daily totals"
                rows={dailyRows}
                getRowKey={(bucket) => bucket.date}
                columns={[
                  { key: "date", header: "Date", kind: "strong", cell: (bucket) => bucket.date },
                  { key: "count", header: "Bookings", kind: "num", className: "tabular-nums", cell: (bucket) => bucket.count },
                  {
                    key: "gmv",
                    header: "GMV",
                    kind: "num",
                    className: "tabular-nums",
                    cell: (bucket) => formatGbp(bucket.gmv_gbp, { decimals: 2 }),
                  },
                  {
                    key: "fee",
                    header: "Platform fee",
                    kind: "num",
                    className: "tabular-nums",
                    cell: (bucket) => formatGbp(bucket.platform_fee_gbp, { decimals: 2 }),
                  },
                  {
                    key: "vendor",
                    header: "Vendor portion",
                    kind: "num",
                    className: "tabular-nums",
                    cell: (bucket) => formatGbp(bucket.vendor_portion_gbp, { decimals: 2 }),
                  },
                ]}
              />
              <TablePagination
                offset={dailyOffset}
                limit={ADMIN_FINANCIALS_DAILY_PAGE_SIZE}
                total={dailyTotal}
                pageRowCount={dailyRows.length}
                loading={dailyLoading}
                onPrevious={() =>
                  setDailyOffset((current) => Math.max(0, current - ADMIN_FINANCIALS_DAILY_PAGE_SIZE))
                }
                onNext={() => setDailyOffset((current) => current + ADMIN_FINANCIALS_DAILY_PAGE_SIZE)}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
