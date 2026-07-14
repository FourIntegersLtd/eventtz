"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ParticipantDisputeStatusBadge } from "@/components/ui/ParticipantDisputeStatusBadge";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { type AdminDisputeCase } from "@/lib/adminPlatformApi";
import {
  disputeBookingLabel,
  formatWhen,
  resolutionActionLabel,
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
  return (
    <>
      <AdminFilterBar>
        <label className="block w-full text-sm sm:w-auto">
          <span className="text-neutral-600">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm sm:w-48"
          >
            <option value="all">All</option>
            <option value="open">Open / under review</option>
            <option value="under_review">Under review only</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </AdminFilterBar>

      {rows.length === 0 ? (
        <EmptyState title="No disputes match this filter" />
      ) : (
        <AdminTable>
          <AdminTableElement>
            <AdminTableHead>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Summary</AdminTableHeaderCell>
              <AdminTableHeaderCell>Booking</AdminTableHeaderCell>
              <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
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
