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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { useServerList } from "@/lib/useServerList";
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
  // The api pages the daily buckets; a new period returns to the first page.
  const daily = useServerList<AdminFinancialsDailyBucket, { from: string; to: string }>({
    pageSize: ADMIN_FINANCIALS_DAILY_PAGE_SIZE,
    errorMessage: "Could not load daily totals.",
    filters: { from: range.from, to: range.to },
    fetchPage: async ({ offset, limit, filters }) => {
      const page = await fetchAdminFinancialsDailyPage(filters.from, filters.to, offset, limit);
      return { items: page.daily, total: page.total };
    },
  });

  const handlePeriodChange = useCallback((next: CommercePeriodDays) => {
    setPeriod(next);
    setRange(commercePeriodRange(next));
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
    if (!onRegisterPageActions) return;
    onRegisterPageActions(
      <Button
        variant="secondary"
        size="sm"
        disabled={exporting}
        onClick={() => {
          setExporting(true);
          void downloadAdminFinancialsCsv(range.from, range.to)
            .catch(() => setError("Could not export financials."))
            .finally(() => setExporting(false));
        }}
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </Button>,
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

          {daily.total > 0 || daily.loading ? (
            <Card as="section">
              <Card.Header>
                <h2 className="ez-h3">Daily totals</h2>
              </Card.Header>
              <DataTable
                aria-label="Daily totals"
                rows={daily.items}
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
                offset={daily.offset}
                limit={daily.limit}
                total={daily.total}
                pageRowCount={daily.items.length}
                loading={daily.loading}
                onPrevious={daily.goPrevious}
                onNext={daily.goNext}
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
