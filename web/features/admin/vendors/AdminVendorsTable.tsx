"use client";

import Link from "next/link";
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
import { vendorIsBulkEmailSelectable } from "@/features/admin/vendors/adminVendorBulkEmail";
import { payloadStr } from "./vendorFormatters";
import {
  vendorAreaLabel,
  vendorCategoryLabel,
  vendorQueueStatusBadge,
  vendorSubmittedLabel,
} from "./adminVendorQueueStatus";

type AdminVendorsTableProps = {
  rows: AdminVendorRow[];
  selectedUserIds?: string[];
  onToggleSelected?: (userId: string, selected: boolean) => void;
};

/** The vendor's own admin page. */
export function adminVendorHref(userId: string): string {
  return `/admin/directory/vendors/${userId}`;
}

export function AdminVendorsTable({
  rows,
  selectedUserIds,
  onToggleSelected,
}: AdminVendorsTableProps) {
  const bulkEnabled = selectedUserIds != null && onToggleSelected != null;
  const selectedSet = new Set(selectedUserIds ?? []);

  if (rows.length === 0) {
    return (
      <EmptyState title="No vendor profiles yet" lottie="searchNoResults" />
    );
  }

  return (
    <AdminTable>
      <AdminTableElement className="min-w-[44rem]">
        <AdminTableHead>
          {bulkEnabled ? (
            <AdminTableHeaderCell className="w-10">
              <span className="sr-only">Select</span>
            </AdminTableHeaderCell>
          ) : null}
          <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
          <AdminTableHeaderCell>Category</AdminTableHeaderCell>
          <AdminTableHeaderCell>Area</AdminTableHeaderCell>
          <AdminTableHeaderCell>Submitted</AdminTableHeaderCell>
          <AdminTableHeaderCell className="ez-td-status">Status</AdminTableHeaderCell>
          <AdminTableHeaderCell> </AdminTableHeaderCell>
        </AdminTableHead>
        <AdminTableBody>
          {rows.map((row) => {
            const payload = row.profile_form_data ?? {};
            const business = payloadStr(payload, "businessName") || "No business name";
            const status = vendorQueueStatusBadge(row);
            const selectable = bulkEnabled && vendorIsBulkEmailSelectable(row);
            return (
              <AdminTableRow key={row.user_id}>
                {bulkEnabled ? (
                  <AdminTableCell className="w-10">
                    {selectable ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                        checked={selectedSet.has(row.user_id)}
                        aria-label={`Select ${business}`}
                        onChange={(event) =>
                          onToggleSelected(row.user_id, event.target.checked)
                        }
                      />
                    ) : null}
                  </AdminTableCell>
                ) : null}
                <AdminTableCell className="ez-td-strong min-w-[10rem] max-w-[14rem]">
                  <Link
                    href={adminVendorHref(row.user_id)}
                    className="block truncate hover:underline"
                    title={business}
                  >
                    {business}
                  </Link>
                </AdminTableCell>
                <AdminTableCell>{vendorCategoryLabel(row)}</AdminTableCell>
                <AdminTableCell>{vendorAreaLabel(row)}</AdminTableCell>
                <AdminTableCell className="whitespace-nowrap">{vendorSubmittedLabel(row)}</AdminTableCell>
                <AdminTableCell className="ez-td-status whitespace-nowrap">
                  <span className={`ez-badge ez-badge--${status.tone}`}>{status.label}</span>
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap">
                  <Link
                    href={adminVendorHref(row.user_id)}
                    className="ez-btn ez-btn--secondary ez-btn--sm"
                  >
                    Review
                  </Link>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTableBody>
      </AdminTableElement>
    </AdminTable>
  );
}
