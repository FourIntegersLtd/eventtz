"use client";

import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorApprovalStatusBadge } from "@/components/badges/VendorApprovalStatusBadge";
import { VendorPayoutStatusBadge } from "@/components/badges/VendorPayoutStatusBadge";
import { VendorProfileStatusBadge } from "@/components/badges/VendorProfileStatusBadge";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import {
  getVendorListingOverride,
  VENDOR_LISTING_OVERRIDE_META,
} from "@/lib/domain-types";
import { payloadStr } from "./vendorFormatters";

type AdminVendorsTableProps = {
  rows: AdminVendorRow[];
  selectedUserIds: string[];
  draftUserIdsOnPage: string[];
  onToggleSelected: (userId: string, selected: boolean) => void;
  onSelectAllDraft: () => void;
  onClearDraftOnPage: () => void;
  onSelect: (userId: string) => void;
};

export function AdminVendorsTable({
  rows,
  selectedUserIds,
  draftUserIdsOnPage,
  onToggleSelected,
  onSelectAllDraft,
  onClearDraftOnPage,
  onSelect,
}: AdminVendorsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState title="No vendor profiles yet" lottie="searchNoResults" />
    );
  }

  const allDraftSelected =
    draftUserIdsOnPage.length > 0 &&
    draftUserIdsOnPage.every((id) => selectedUserIds.includes(id));

  return (
    <AdminTable>
      <AdminTableElement className="min-w-[50rem]">
        <AdminTableHead>
          <AdminTableHeaderCell className="w-10">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300"
              checked={allDraftSelected}
              disabled={draftUserIdsOnPage.length === 0}
              onChange={() => (allDraftSelected ? onClearDraftOnPage() : onSelectAllDraft())}
              aria-label="Select all draft vendors on this page"
              title="Select draft vendors on this page"
            />
          </AdminTableHeaderCell>
          <AdminTableHeaderCell className="min-w-[11rem]">Email</AdminTableHeaderCell>
          <AdminTableHeaderCell className="min-w-[8rem]">Business</AdminTableHeaderCell>
          <AdminTableHeaderCell>Form</AdminTableHeaderCell>
          <AdminTableHeaderCell>Approval</AdminTableHeaderCell>
          <AdminTableHeaderCell>Payouts</AdminTableHeaderCell>
          <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
          <AdminTableHeaderCell className="text-right">Action</AdminTableHeaderCell>
        </AdminTableHead>
        <AdminTableBody>
          {rows.map((r) => {
            const p = r.profile_form_data ?? {};
            const biz = payloadStr(p, "businessName") || "-";
            const email = r.email ?? "-";
            const updated = r.updated_at ? new Date(r.updated_at).toLocaleString() : "-";
            const pending = r.approval_status === "pending";
            const isDraft = r.onboarding_status === "draft";
            const approvedNotLive = r.approval_status === "approved" && !r.listing_visible;
            const override = getVendorListingOverride(r.listing_override);
            const selected = selectedUserIds.includes(r.user_id);
            return (
              <AdminTableRow
                key={r.user_id}
                className={pending || approvedNotLive ? "bg-amber-50/40" : undefined}
              >
                <AdminTableCell className="w-10">
                  {isDraft ? (
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300"
                      checked={selected}
                      onChange={(e) => onToggleSelected(r.user_id, e.target.checked)}
                      aria-label={`Select ${email}`}
                    />
                  ) : null}
                </AdminTableCell>
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
                  <VendorProfileStatusBadge status={r.onboarding_status} />
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap">
                  <VendorApprovalStatusBadge status={r.approval_status} />
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap">
                  <VendorPayoutStatusBadge verified={r.payouts_verified} />
                  {override !== "auto" ? (
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${VENDOR_LISTING_OVERRIDE_META[override].badgeClassName}`}
                    >
                      {VENDOR_LISTING_OVERRIDE_META[override].label}
                    </span>
                  ) : approvedNotLive ? (
                    <span className="mt-1 block text-xs text-amber-800">Hidden from clients</span>
                  ) : null}
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
