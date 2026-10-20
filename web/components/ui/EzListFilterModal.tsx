"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type EzListFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onClearAll?: () => void;
  clearAllDisabled?: boolean;
  clearAllLabel?: string;
  children: ReactNode;
};

/** One modal shell for all list filters; sections go in `children`. */
export function EzListFilterModal({
  isOpen,
  onClose,
  title,
  description,
  onClearAll,
  clearAllDisabled = false,
  clearAllLabel = "Clear filters",
  children,
}: EzListFilterModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidthClassName="max-w-md"
      bodyMaxHeightClassName="max-h-[min(70dvh,560px)]"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
          {onClearAll ? (
            <Button type="button" variant="secondary" disabled={clearAllDisabled} onClick={onClearAll}>
              {clearAllLabel}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      {description ? <p className="ez-small mb-5 text-neutral-600">{description}</p> : null}
      <div className="flex flex-col gap-6">{children}</div>
    </Modal>
  );
}
