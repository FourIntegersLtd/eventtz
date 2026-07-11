"use client";

import Link from "next/link";
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
import { type AdminDisputeCase } from "@/lib/adminPlatformApi";
import {
  DisputeOpenedByCallout,
  DisputeOpenedBySummary,
  DisputePartiesSummary,
} from "./DisputePartiesSummary";
import {
  disputeBookingLabel,
  disputeStatusBadgeClass,
  formatWhen,
  resolutionActionLabel,
  statusLabel,
} from "./disputeFormatters";

type DisputesTableProps = {
  rows: AdminDisputeCase[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onManage: (dispute: AdminDisputeCase) => void;
};

export function DisputesTable({
  rows,
  statusFilter,
  onStatusFilterChange,
  onManage,
}: DisputesTableProps) {
  const filtered =
    statusFilter === "all"
      ? rows
      : statusFilter === "open"
        ? rows.filter((r) => r.status === "open" || r.status === "under_review")
        : rows.filter((r) => r.status === statusFilter);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-neutral-600">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="open">Open / under review</option>
            <option value="under_review">Under review only</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No disputes match this filter" />
      ) : (
        <AdminTable>
          <AdminTableElement>
            <AdminTableHead>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Booking</AdminTableHeaderCell>
              <AdminTableHeaderCell>Parties</AdminTableHeaderCell>
              <AdminTableHeaderCell>Opened by</AdminTableHeaderCell>
              <AdminTableHeaderCell>Summary</AdminTableHeaderCell>
              <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {filtered.map((r) => (
                <AdminTableRow key={r.id}>
                  <AdminTableCell className="align-top">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${disputeStatusBadgeClass(r.status)}`}
                    >
                      {statusLabel(r.status)}
                    </span>
                    {r.status === "resolved" && r.resolution_action ? (
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {resolutionActionLabel(r.resolution_action)}
                      </p>
                    ) : null}
                  </AdminTableCell>
                  <AdminTableCell className="align-top">
                    <Link
                      href={`/admin/bookings/${r.booking_request_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {disputeBookingLabel(r)}
                    </Link>
                    {r.booking_status ? (
                      <p className="mt-0.5 text-[11px] capitalize text-neutral-500">
                        {r.booking_status.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </AdminTableCell>
                  <AdminTableCell className="max-w-[14rem] align-top">
                    <DisputePartiesSummary dispute={r} />
                  </AdminTableCell>
                  <AdminTableCell className="max-w-[11rem] align-top">
                    <DisputeOpenedBySummary dispute={r} />
                  </AdminTableCell>
                  <AdminTableCell className="max-w-md align-top text-neutral-800">
                    <p className="line-clamp-2">{r.summary}</p>
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap align-top text-xs text-neutral-500">
                    {formatWhen(r.updated_at)}
                  </AdminTableCell>
                  <AdminTableCell className="align-top text-right">
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
