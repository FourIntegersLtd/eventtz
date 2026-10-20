"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AdminFilterDateField } from "@/features/admin/components/AdminFilterDateField";

type EzFilterDateRangeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fromLabel?: string;
  toLabel?: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onReset: () => void;
};

/** Modal for optional event-date (or similar) from/to filters. */
export function EzFilterDateRangeModal({
  isOpen,
  onClose,
  title,
  description,
  fromLabel = "From",
  toLabel = "To",
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
}: EzFilterDateRangeModalProps) {
  const hasRange = Boolean(from) || Boolean(to);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidthClassName="max-w-md"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="secondary" disabled={!hasRange} onClick={onReset}>
            Clear dates
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      {description ? <p className="ez-small mb-4 text-neutral-600">{description}</p> : null}
      <div className="flex flex-col gap-4">
        <AdminFilterDateField label={fromLabel} value={from} onChange={onFromChange} />
        <AdminFilterDateField label={toLabel} value={to} onChange={onToChange} />
      </div>
    </Modal>
  );
}
