"use client";

import type { ReactNode } from "react";
import { adminCard } from "@/features/admin/adminTheme";

type AdminTableProps = {
  children: ReactNode;
  className?: string;
};

export function AdminTable({ children, className = "" }: AdminTableProps) {
  return (
    <div className={`${adminCard} overflow-hidden ${className}`.trim()}>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">{children}</div>
    </div>
  );
}

export function AdminTableElement({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={`min-w-full divide-y divide-neutral-200 text-sm ${className}`.trim()}>
      {children}
    </table>
  );
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-neutral-50">
      <tr>{children}</tr>
    </thead>
  );
}

export function AdminTableHeaderCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 ${className}`.trim()}
    >
      {children}
    </th>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-neutral-100 bg-white">{children}</tbody>;
}

export function AdminTableRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={`transition hover:bg-neutral-50/80 ${className}`.trim()}>{children}</tr>
  );
}

export function AdminTableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-neutral-800 ${className}`.trim()}>{children}</td>;
}
