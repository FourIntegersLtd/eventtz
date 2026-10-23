"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ParticipantDisputeStatusBadge } from "@/components/badges/ParticipantDisputeStatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { type AdminDisputeCase } from "@/lib/adminPlatformApi";
import {
  disputeBookingLabel,
  formatWhen,
  resolutionActionLabel,
} from "./disputeFormatters";

const STATUS_FILTER_OPTIONS: EzFilterOption<string>[] = [
  { id: "open", title: "Open / under review" },
  { id: "under_review", title: "Under review only" },
  { id: "resolved", title: "Resolved" },
  { id: "closed", title: "Closed" },
];

function disputeStatusFilterLabel(statusFilter: string): string {
  return STATUS_FILTER_OPTIONS.find((option) => option.id === statusFilter)?.title ?? "Filter";
}

type DisputesTableProps = {
  rows: AdminDisputeCase[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onManage: (dispute: AdminDisputeCase) => void;
};

function partiesLabel(row: AdminDisputeCase): string {
  const client = row.client_email ?? "Client";
  const vendor = row.vendor_display_name ?? "Vendor";
  return `${client} / ${vendor}`;
}

export function DisputesTable({
  rows,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  onManage,
}: DisputesTableProps) {
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const resolvedStatus = statusFilter === "all" ? "open" : statusFilter;
  const statusActive = resolvedStatus !== "open";
  const statusLabel = disputeStatusFilterLabel(resolvedStatus);

  return (
    <>
      <EzListFilterToolbar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search booking or party"
        searchAriaLabel="Search booking or party"
        searchMaxWidth="16rem"
        onOpenFilter={() => setStatusModalOpen(true)}
        activeFilterCount={statusActive ? 1 : 0}
        summary={
          statusActive ? { label: statusLabel, onClear: () => onStatusFilterChange("open") } : null
        }
      />

      <EzFilterOptionsModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Filter disputes"
        description="Narrow the list by dispute status. Search still applies on top."
        options={STATUS_FILTER_OPTIONS}
        value={resolvedStatus}
        onChange={onStatusFilterChange}
        listAriaLabel="Dispute status"
        resetValue="open"
        resetLabel="Reset to open"
      />

      {rows.length === 0 ? (
        <EmptyState title="No disputes match this filter" lottie="searchNoResults" />
      ) : (
        <DataTable
          aria-label="Disputes"
          tableClassName="min-w-[40rem]"
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            {
              key: "status",
              header: "Status",
              className: "w-[7rem] align-top",
              cell: (row) => (
                <>
                  <ParticipantDisputeStatusBadge status={row.status} />
                  {row.status === "resolved" && row.resolution_action ? (
                    <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                      {resolutionActionLabel(row.resolution_action)}
                    </p>
                  ) : null}
                </>
              ),
            },
            {
              key: "summary",
              header: "Summary",
              className: "min-w-[12rem] max-w-md align-top",
              cell: (row) => <p className="line-clamp-2 text-sm text-neutral-900">{row.summary}</p>,
            },
            {
              key: "booking",
              header: "Booking",
              className: "max-w-[11rem] align-top",
              cell: (row) => (
                <Link
                  href={`/admin/bookings/${row.booking_request_id}`}
                  className="line-clamp-2 text-sm font-medium text-primary hover:underline"
                  title={disputeBookingLabel(row)}
                >
                  {disputeBookingLabel(row)}
                </Link>
              ),
            },
            {
              key: "updated",
              header: "Updated",
              className: "whitespace-nowrap align-top text-xs text-neutral-500",
              cell: (row) => formatWhen(row.updated_at),
            },
            {
              key: "actions",
              header: "Actions",
              className: "align-top",
              cell: (row) => (
                <button
                  type="button"
                  onClick={() => onManage(row)}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  Manage
                </button>
              ),
            },
          ]}
        />
      )}
    </>
  );
}