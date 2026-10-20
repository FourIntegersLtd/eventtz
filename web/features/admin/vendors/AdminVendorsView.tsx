"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import { adminFilterControlClass } from "@/features/admin/components/adminFilterControlClass";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminVendorsTable } from "@/features/admin/vendors/AdminVendorsTable";
import { useAdminVendors } from "@/features/admin/vendors/useAdminVendors";
import type { AdminVendorProfileNudgeResult } from "@/lib/adminVendorsApi";
import {
  vendorQueueFilters,
  type VendorQueueTab,
} from "@/features/admin/vendors/adminVendorQueueStatus";
import {
  AdminVendorQueueFilterModal,
  vendorQueueTabLabel,
} from "@/features/admin/vendors/AdminVendorQueueFilterModal";

function nudgeToastSummary(result: AdminVendorProfileNudgeResult): string {
  const parts: string[] = [];
  if (result.sent > 0) {
    parts.push(`${result.sent} sent`);
  }
  if (result.skipped > 0) {
    parts.push(`${result.skipped} skipped`);
  }
  if (result.failures.length > 0) {
    parts.push(`${result.failures.length} failed`);
  }
  return parts.length > 0 ? parts.join(", ") : "No emails sent";
}

export function AdminVendorsView() {
  const [queueTab, setQueueTab] = useState<VendorQueueTab>("pending");
  const [filterOpen, setFilterOpen] = useState(false);
  const { showToast } = useToast();
  const {
    rows,
    total,
    offset,
    limit,
    setOffset,
    loading,
    error,
    search,
    setSearch,
    setApprovalStatus,
    setProfileStatus,
    setReturnedForEdits,
    selectedUserIds,
    selectedDraftCount,
    selectedPayoutCount,
    toggleSelectedUserId,
    selectAllSelectableOnPage,
    clearSelectableOnPage,
    nudgeDraftVendors,
    nudgePayoutVendors,
    nudgeBusy,
  } = useAdminVendors();

  useEffect(() => {
    const filters = vendorQueueFilters(queueTab);
    setOffset(0);
    setApprovalStatus(filters.approvalStatus);
    setProfileStatus(filters.profileStatus);
    setReturnedForEdits(filters.returnedForEdits);
  }, [queueTab, setApprovalStatus, setOffset, setProfileStatus, setReturnedForEdits]);

  const runProfileNudge = useCallback(async () => {
    const outcome = await nudgeDraftVendors();
    if (!outcome || outcome.kind === "error") return;
    showToast({
      title: "Profile reminders sent",
      description: nudgeToastSummary(outcome.result),
      tone: outcome.result.failures.length > 0 ? "neutral" : "success",
    });
  }, [nudgeDraftVendors, showToast]);

  const runPayoutNudge = useCallback(async () => {
    const outcome = await nudgePayoutVendors();
    if (!outcome || outcome.kind === "error") return;
    showToast({
      title: "Payout reminders sent",
      description: nudgeToastSummary(outcome.result),
      tone: outcome.result.failures.length > 0 ? "neutral" : "success",
    });
  }, [nudgePayoutVendors, showToast]);

  const activeFilterLabel = vendorQueueTabLabel(queueTab);
  const activeFilterCount = queueTab !== "pending" ? 1 : 0;

  return (
    <div className="ez-stack ez-stack--lg">
      {error ? <AdminErrorBanner message={error} /> : null}

      <EzListFilterToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setOffset(0);
          setSearch(value);
        }}
        searchPlaceholder="Search email or business"
        searchAriaLabel="Search email or business"
        inputClassName={adminFilterControlClass}
        onOpenFilter={() => setFilterOpen(true)}
        activeFilterCount={activeFilterCount}
        summary={
          queueTab !== "pending"
            ? {
                label: activeFilterLabel,
                onClear: () => {
                  setQueueTab("pending");
                },
              }
            : null
        }
      />

      <AdminVendorQueueFilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={queueTab}
        onChange={setQueueTab}
        showReminders={!loading && rows.length > 0}
        selectedCount={selectedUserIds.length}
        selectedDraftCount={selectedDraftCount}
        selectedPayoutCount={selectedPayoutCount}
        nudgeBusy={nudgeBusy}
        onSelectAllOnPage={selectAllSelectableOnPage}
        onClearPage={clearSelectableOnPage}
        onNudgeProfile={() => void runProfileNudge()}
        onNudgePayout={() => void runPayoutNudge()}
      />

      {loading ? (
        <AdminLoadingState label="Loading vendors…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No vendors match your filters" lottie="searchNoResults" />
      ) : (
        <>
          <AdminVendorsTable
            rows={rows}
            selectedUserIds={selectedUserIds}
            onToggleSelected={toggleSelectedUserId}
          />
          <TablePagination
            offset={offset}
            limit={limit}
            total={total}
            pageRowCount={rows.length}
            onPrevious={() => setOffset(Math.max(0, offset - limit))}
            onNext={() => setOffset(offset + limit)}
          />
        </>
      )}
    </div>
  );
}
