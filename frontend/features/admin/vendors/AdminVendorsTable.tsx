"use client";

import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { approvalLabel, payloadStr } from "./vendorFormatters";

function ApprovalBadge({ status }: { status: string }) {
  const classes =
    status === "approved"
      ? "bg-emerald-100 text-emerald-900"
      : status === "banned"
        ? "bg-red-100 text-red-900"
        : "bg-amber-100 text-amber-900";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {approvalLabel(status)}
    </span>
  );
}

type AdminVendorsTableProps = {
  rows: AdminVendorRow[];
  onSelect: (userId: string) => void;
};

export function AdminVendorsTable({ rows, onSelect }: AdminVendorsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState title="No vendor profiles yet" />
    );
  }

  return (
    <AdminTable>
      <AdminTableElement>
        <AdminTableHead>
          <AdminTableHeaderCell>Email</AdminTableHeaderCell>
          <AdminTableHeaderCell>Business</AdminTableHeaderCell>
          <AdminTableHeaderCell>Form</AdminTableHeaderCell>
          <AdminTableHeaderCell>Approval</AdminTableHeaderCell>
          <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
          <AdminTableHeaderCell className="text-right">Action</AdminTableHeaderCell>
        </AdminTableHead>
        <AdminTableBody>
          {rows.map((r) => {
            const p = r.payload ?? {};
            const biz = payloadStr(p, "businessName") || "—";
            const email = r.email ?? "—";
            const updated = r.updated_at ? new Date(r.updated_at).toLocaleString() : "—";
            const pending = r.approval_status === "pending";
            return (
              <AdminTableRow
                key={r.user_id}
                className={pending ? "bg-amber-50/40" : undefined}
              >
                <AdminTableCell className="max-w-[200px] break-all">{email}</AdminTableCell>
                <AdminTableCell className="max-w-[160px]">{biz}</AdminTableCell>
                <AdminTableCell className="whitespace-nowrap text-neutral-600">{r.status}</AdminTableCell>
                <AdminTableCell className="whitespace-nowrap">
                  <ApprovalBadge status={r.approval_status} />
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap text-neutral-500">{updated}</AdminTableCell>
                <AdminTableCell className="whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(r.user_id)}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Review
                  </button>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTableBody>
      </AdminTableElement>
    </AdminTable>
  );
}
