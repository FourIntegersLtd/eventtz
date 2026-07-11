"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type FinancialsPeriod = "30d" | "month";

const PERIODS: { value: FinancialsPeriod; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "month", label: "Month" },
];

type AdminFinancialsPeriodControlProps = {
  period: FinancialsPeriod;
  csvBusy: boolean;
  onPeriodChange: (period: FinancialsPeriod) => void;
  onExportCsv: () => void;
};

/** Single pill: period toggle + CSV export. */
export function AdminFinancialsPeriodControl({
  period,
  csvBusy,
  onPeriodChange,
  onExportCsv,
}: AdminFinancialsPeriodControlProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1"
      role="group"
      aria-label="Reporting period"
    >
      {PERIODS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPeriodChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            period === opt.value
              ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200/90" aria-hidden />
      <Button
        variant="ghost"
        size="sm"
        className="min-h-9 gap-0 px-2.5"
        icon={<Download className="h-4 w-4" aria-hidden />}
        loading={csvBusy}
        aria-label="Export CSV"
        title="Export CSV"
        onClick={onExportCsv}
      />
    </div>
  );
}

export function financialsPeriodRange(period: FinancialsPeriod): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (period === "30d") {
    from.setDate(from.getDate() - 30);
  } else {
    from.setDate(1);
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}
