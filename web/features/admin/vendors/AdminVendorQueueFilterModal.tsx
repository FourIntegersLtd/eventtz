"use client";

import { EzFilterModalSection } from "@/components/ui/EzFilterModalSection";
import { EzFilterOptionList } from "@/components/ui/EzFilterOptionList";
import { EzListFilterModal } from "@/components/ui/EzListFilterModal";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { AdminVendorRemindersPanel } from "@/features/admin/vendors/AdminVendorRemindersPanel";
import type { VendorQueueTab } from "./adminVendorQueueStatus";

export const VENDOR_QUEUE_FILTER_OPTIONS: EzFilterOption<VendorQueueTab>[] = [
  {
    id: "pending",
    title: "Pending review",
    subtitle: "Submitted profiles waiting for staff",
  },
  {
    id: "returned",
    title: "Returned for edits",
    subtitle: "Sent back to the vendor to fix",
  },
  {
    id: "draft",
    title: "Draft in progress",
    subtitle: "Not submitted yet (excluding returned)",
  },
  {
    id: "approved",
    title: "Approved",
    subtitle: "Live or ready for marketplace rules",
  },
  {
    id: "suspended",
    title: "Suspended",
    subtitle: "Banned from the platform",
  },
];

export function vendorQueueTabLabel(tab: VendorQueueTab): string {
  return VENDOR_QUEUE_FILTER_OPTIONS.find((option) => option.id === tab)?.title ?? "Filter";
}

type AdminVendorQueueFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  value: VendorQueueTab;
  onChange: (tab: VendorQueueTab) => void;
  showReminders?: boolean;
  selectedCount?: number;
  selectedDraftCount?: number;
  selectedPayoutCount?: number;
  nudgeBusy?: boolean;
  onSelectAllOnPage?: () => void;
  onClearPage?: () => void;
  onNudgeProfile?: () => void;
  onNudgePayout?: () => void;
};

export function AdminVendorQueueFilterModal({
  isOpen,
  onClose,
  value,
  onChange,
  showReminders = false,
  selectedCount = 0,
  selectedDraftCount = 0,
  selectedPayoutCount = 0,
  nudgeBusy = false,
  onSelectAllOnPage,
  onClearPage,
  onNudgeProfile,
  onNudgePayout,
}: AdminVendorQueueFilterModalProps) {
  const remindersReady =
    showReminders &&
    onSelectAllOnPage &&
    onClearPage &&
    onNudgeProfile &&
    onNudgePayout;

  const queueActive = value !== "pending";

  return (
    <EzListFilterModal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter vendors"
      description="Choose which queue to work. Search still applies on top of this filter."
      onClearAll={() => onChange("pending")}
      clearAllDisabled={!queueActive}
      clearAllLabel="Reset to pending"
    >
      <EzFilterModalSection title="Queue">
        <EzFilterOptionList
          options={VENDOR_QUEUE_FILTER_OPTIONS}
          value={value}
          onChange={onChange}
          listAriaLabel="Vendor queue"
        />
      </EzFilterModalSection>

      {remindersReady ? (
        <AdminVendorRemindersPanel
          selectedCount={selectedCount}
          selectedDraftCount={selectedDraftCount}
          selectedPayoutCount={selectedPayoutCount}
          nudgeBusy={nudgeBusy}
          onSelectAllOnPage={onSelectAllOnPage}
          onClearPage={onClearPage}
          onNudgeProfile={onNudgeProfile}
          onNudgePayout={onNudgePayout}
        />
      ) : null}
    </EzListFilterModal>
  );
}
