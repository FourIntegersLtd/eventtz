"use client";

import { useCallback, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminVendorsTable } from "@/features/admin/vendors/AdminVendorsTable";
import { useAdminVendors } from "@/features/admin/vendors/useAdminVendors";
import type { AdminVendorProfileNudgeResult } from "@/lib/adminVendorsApi";
import {
  AdminVendorQueueFilterModal,
  vendorQueueTabLabel,
} from "@/features/admin/vendors/AdminVendorQueueFilterModal";
import {
  DEFAULT_VENDOR_QUEUE_TAB,
  vendorListEmptyCopy,
  type VendorQueueTab,
} from "@/features/admin/vendors/adminVendorQueueStatus";

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

/** The admin vendors list; `initialQueueTab` comes from the `queue` url parameter (dashboard links use it). */
export function AdminVendorsView({ initialQueueTab }: { initialQueueTab: VendorQueueTab }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const { showToast } = useToast();
  const {
    rows,
    total,
    offset,
    limit,
    goPrevious,
    goNext,
    loading,
    error,
    search,
    setSearch,
    queueTab,
    setQueueTab,
    selectedUserIds,
    selectedDraftCount,
    selectedPayoutCount,
    toggleSelectedUserId,
    selectAllSelectableOnPage,
    clearSelectableOnPage,
    nudgeDraftVendors,
    nudgePayoutVendors,
    nudgeBusy,
  } = useAdminVendors(initialQueueTab);

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
  const filtered = queueTab !== DEFAULT_VENDOR_QUEUE_TAB;
  const activeFilterCount = filtered ? 1 : 0;
  const emptyCopy = vendorListEmptyCopy(queueTab, activeFilterLabel, search);

  return (
    <div className="ez-stack ez-stack--lg">
      {error ? <AdminErrorBanner message={error} /> : null}

      <EzListFilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search email or business"
        searchAriaLabel="Search email or business"
        onOpenFilter={() => setFilterOpen(true)}
        activeFilterCount={activeFilterCount}
        summary={{
          label: activeFilterLabel,
          onClear: filtered ? () => setQueueTab(DEFAULT_VENDOR_QUEUE_TAB) : undefined,
        }}
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
        <EmptyState
          title={emptyCopy.title}
          description={emptyCopy.description}
          lottie="searchNoResults"
        />
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
            onPrevious={goPrevious}
            onNext={goNext}
          />
        </>
      )}
    </div>
  );
}
