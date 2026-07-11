"use client";

import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorApprovalStatusBadge } from "@/components/ui/VendorApprovalStatusBadge";
import { VendorProfileStatusBadge } from "@/components/ui/VendorProfileStatusBadge";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { payloadStr } from "./vendorFormatters";

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
      <AdminTableElement className="min-w-[42rem]">
        <AdminTableHead>
          <AdminTableHeaderCell className="min-w-[11rem]">Email</AdminTableHeaderCell>
          <AdminTableHeaderCell className="min-w-[8rem]">Business</AdminTableHeaderCell>
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
                <AdminTableCell className="min-w-[11rem] max-w-[14rem]">
                  <span className="block truncate" title={email}>
                    {email}
                  </span>
                </AdminTableCell>
                <AdminTableCell className="min-w-[8rem] max-w-[12rem]">
                  <span className="block truncate" title={biz}>
                    {biz}
                  </span>
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap">
                  <VendorProfileStatusBadge status={r.status} />
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap">
                  <VendorApprovalStatusBadge status={r.approval_status} />
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
