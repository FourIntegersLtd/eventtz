"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ParticipantDisputeStatusBadge } from "@/components/badges/ParticipantDisputeStatusBadge";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { adminFilterControlClass } from "@/features/admin/components/adminFilterControlClass";
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
        inputClassName={adminFilterControlClass}
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
        <AdminTable>
          <AdminTableElement className="min-w-[40rem]">
            <AdminTableHead>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Summary</AdminTableHeaderCell>
              <AdminTableHeaderCell>Booking</AdminTableHeaderCell>
              <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
              <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {rows.map((r) => (
                <AdminTableRow key={r.id}>
                  <AdminTableCell className="w-[7rem] align-top">
                    <ParticipantDisputeStatusBadge status={r.status} />
                    {r.status === "resolved" && r.resolution_action ? (
                      <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                        {resolutionActionLabel(r.resolution_action)}
                      </p>
                    ) : null}
                  </AdminTableCell>
                  <AdminTableCell className="min-w-[12rem] max-w-md align-top">
                    <p className="line-clamp-2 text-sm text-neutral-900">{r.summary}</p>
                  </AdminTableCell>
                  <AdminTableCell className="max-w-[11rem] align-top">
                    <Link
                      href={`/admin/bookings/${r.booking_request_id}`}
                      className="line-clamp-2 text-sm font-medium text-primary hover:underline"
                      title={disputeBookingLabel(r)}
                    >
                      {disputeBookingLabel(r)}
                    </Link>
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap align-top text-xs text-neutral-500">
                    {formatWhen(r.updated_at)}
                  </AdminTableCell>
                  <AdminTableCell className="align-top">
                    <button
                      type="button"
                      onClick={() => onManage(r)}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                    >
                      Manage
                    </button>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}
    </>
  );
}