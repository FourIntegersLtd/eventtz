import type { ReactNode } from "react";
import { Spinner } from "@/foundation/ui";

/** Shared loading row for admin list/detail screens, matching `AdminLoadingState`. */
export function AdminLoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-primary-border bg-white p-10">
      <Spinner label={label} />
    </div>
  );
}

/** An inline error banner, matching `AdminErrorBanner`. */
export function AdminErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

/** An inline success banner, matching `AdminSuccessBanner`. */
export function AdminSuccessBanner({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
      {message}
    </div>
  );
}

/** The centered empty-state card used on every list screen. */
export function AdminEmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary-border bg-white p-10 text-center">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      {hint ? <p className="mt-1 text-sm text-neutral-500">{hint}</p> : null}
    </div>
  );
}

/** A subtitle plus an optional actions slot above a list, matching `AdminPageHeader`. */
export function AdminPageHeader({ subtitle, actions }: { subtitle?: string; actions?: ReactNode }) {
  if (!subtitle && !actions) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : <span />}
      {actions}
    </div>
  );
}

/** The card surface every admin table/panel sits on. */
export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-primary-border bg-white ${className ?? ""}`}>
      {children}
    </div>
  );
}

/** A plain data table, wrapped in `AdminCard`'s horizontal-scroll surface. */
export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <AdminCard>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </AdminCard>
  );
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-primary-border bg-primary-soft/40 text-xs uppercase text-neutral-500">{children}</thead>;
}

export function AdminTableHeaderCell({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-primary-border">{children}</tbody>;
}

export function AdminTableRow({ children, tinted }: { children: ReactNode; tinted?: "critical" | "warning" }) {
  const className =
    tinted === "critical" ? "bg-red-50" : tinted === "warning" ? "bg-amber-50" : undefined;
  return <tr className={className}>{children}</tr>;
}

export function AdminTableCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

/** A stat tile for headline numbers (dashboard, financials). No chart library is available yet — see hand-off. */
export function AdminKpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-primary-border bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

/** Previous/Next pagination footer shared by every admin list. */
export function AdminPagination({
  offset,
  limit,
  total,
  onPrevious,
  onNext,
}: {
  offset: number;
  limit: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (total === 0) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-neutral-600">
      <span>
        Showing {from}-{to} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={offset === 0}
          className="rounded-lg border border-primary-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={to >= total}
          className="rounded-lg border border-primary-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
