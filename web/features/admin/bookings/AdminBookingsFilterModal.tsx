"use client";

import { EzFilterModalSection } from "@/components/ui/EzFilterModalSection";
import { EzFilterOptionList } from "@/components/ui/EzFilterOptionList";
import { EzListFilterModal } from "@/components/ui/EzListFilterModal";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { AdminFilterDateField } from "@/features/admin/components/AdminFilterDateField";

const BOOKING_STATUS_FILTER_OPTIONS: EzFilterOption<string>[] = [
  { id: "", title: "All statuses" },
  { id: "pending", title: "Pending" },
  { id: "accepted", title: "Accepted" },
  { id: "completed", title: "Completed" },
  { id: "declined", title: "Declined" },
  { id: "cancelled", title: "Cancelled" },
];

type AdminBookingsFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
};

export function AdminBookingsFilterModal({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  status,
  onStatusChange,
  onClearAll,
  hasActiveFilters,
}: AdminBookingsFilterModalProps) {
  return (
    <EzListFilterModal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter bookings"
      description="Narrow by event date and request status. Search still applies on top."
      onClearAll={onClearAll}
      clearAllDisabled={!hasActiveFilters}
      clearAllLabel="Clear filters"
    >
      <EzFilterModalSection
        title="Event dates"
        description="Optional range on the booking event date."
      >
        <div className="flex flex-col gap-4">
          <AdminFilterDateField label="From" value={dateFrom} onChange={onDateFromChange} />
          <AdminFilterDateField label="To" value={dateTo} onChange={onDateToChange} />
        </div>
      </EzFilterModalSection>

      <EzFilterModalSection title="Request status">
        <EzFilterOptionList
          options={BOOKING_STATUS_FILTER_OPTIONS}
          value={status}
          onChange={onStatusChange}
          listAriaLabel="Request status"
        />
      </EzFilterModalSection>
    </EzListFilterModal>
  );
}

export function bookingStatusFilterLabel(status: string): string {
  return BOOKING_STATUS_FILTER_OPTIONS.find((option) => option.id === status)?.title ?? "Status";
}

export function eventDatesFilterSummary(from: string, to: string): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return "Event dates";
}
