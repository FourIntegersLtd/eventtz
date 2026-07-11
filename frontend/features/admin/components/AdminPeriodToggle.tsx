"use client";

import type { DashboardMetricsPeriod } from "@/features/admin/dashboard/useAdminDashboardMetrics";

const OPTIONS: { value: DashboardMetricsPeriod; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

type AdminPeriodToggleProps = {
  value: DashboardMetricsPeriod;
  onChange: (value: DashboardMetricsPeriod) => void;
};

export function AdminPeriodToggle({ value, onChange }: AdminPeriodToggleProps) {
  return (
    <div
      className="inline-flex gap-1 rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1"
      role="group"
      aria-label="Chart period"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === opt.value
              ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
