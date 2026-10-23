"use client";

import Link from "next/link";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { vendorIsBulkEmailSelectable } from "@/features/admin/vendors/adminVendorBulkEmail";
import { payloadStr } from "./vendorFormatters";
import {
  vendorAreaLabel,
  vendorCategoryLabel,
  vendorQueueStatusBadge,
  vendorSubmittedLabel,
} from "./adminVendorQueueStatus";
import { ButtonLink } from "@/components/ui/ButtonLink";

type AdminVendorsTableProps = {
  rows: AdminVendorRow[];
  selectedUserIds?: string[];
  onToggleSelected?: (userId: string, selected: boolean) => void;
};

/** The vendor's own admin page. */
export function adminVendorHref(userId: string): string {
  return `/admin/directory/vendors/${userId}`;
}

/** The name shown for a vendor row, with a placeholder when the profile has none. */
function vendorBusinessName(row: AdminVendorRow): string {
  return payloadStr(row.profile_form_data ?? {}, "businessName") || "No business name";
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

  const columns: DataTableColumn<AdminVendorRow>[] = [
    ...(bulkEnabled
      ? [
          {
            key: "select",
            header: <span className="sr-only">Select</span>,
            headerClassName: "w-10",
            className: "w-10",
            cell: (row: AdminVendorRow) =>
              vendorIsBulkEmailSelectable(row) ? (
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line-strong text-primary focus:ring-primary"
                  checked={selectedSet.has(row.user_id)}
                  aria-label={`Select ${vendorBusinessName(row)}`}
                  onChange={(event) => onToggleSelected(row.user_id, event.target.checked)}
                />
              ) : null,
          },
        ]
      : []),
    {
      key: "vendor",
      header: "Vendor",
      kind: "strong" as const,
      className: "min-w-[10rem] max-w-[14rem]",
      cell: (row) => (
        <Link
          href={adminVendorHref(row.user_id)}
          className="block truncate hover:underline"
          title={vendorBusinessName(row)}
        >
          {vendorBusinessName(row)}
        </Link>
      ),
    },
    { key: "category", header: "Category", cell: (row) => vendorCategoryLabel(row) },
    { key: "area", header: "Area", cell: (row) => vendorAreaLabel(row) },
    { key: "submitted", header: "Submitted", className: "whitespace-nowrap", cell: (row) => vendorSubmittedLabel(row) },
    {
      key: "status",
      header: "Status",
      kind: "status" as const,
      className: "whitespace-nowrap",
      cell: (row) => {
        const status = vendorQueueStatusBadge(row);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "review",
      header: " ",
      className: "whitespace-nowrap",
      cell: (row) => (
        <ButtonLink variant="secondary" size="sm" href={adminVendorHref(row.user_id)}>
          Review
        </ButtonLink>
      ),
    },
  ];

  return (
    <DataTable
      aria-label="Vendors"
      tableClassName="min-w-[44rem]"
      rows={rows}
      getRowKey={(row) => row.user_id}
      columns={columns}
    />
  );
}
