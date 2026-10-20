"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EzFilterOptionList } from "@/components/ui/EzFilterOptionList";
import { EzListFilterModal } from "@/components/ui/EzListFilterModal";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";

type EzFilterOptionsModalProps<T extends string> = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  options: readonly EzFilterOption<T>[];
  value: T;
  onChange: (id: T) => void;
  listAriaLabel: string;
  resetValue?: T;
  resetLabel?: string;
  /** When true, picking an option closes the modal. Default true. */
  closeOnPick?: boolean;
  /** Extra blocks below the option list (e.g. related bulk actions). */
  afterOptions?: ReactNode;
};

/** Single-dimension filter in the shared list-filter modal shell. */
export function EzFilterOptionsModal<T extends string>({
  isOpen,
  onClose,
  title,
  description,
  options,
  value,
  onChange,
  listAriaLabel,
  resetValue,
  resetLabel = "Reset",
  closeOnPick = true,
  afterOptions,
}: EzFilterOptionsModalProps<T>) {
  const canReset = resetValue !== undefined && value !== resetValue;

  const clearToDefault = () => {
    if (resetValue === undefined) return;
    onChange(resetValue);
    if (closeOnPick) onClose();
  };

  return (
    <EzListFilterModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      onClearAll={resetValue !== undefined ? clearToDefault : undefined}
      clearAllDisabled={!canReset}
      clearAllLabel={resetLabel}
    >
      <EzFilterOptionList
        options={options}
        value={value}
        onChange={onChange}
        listAriaLabel={listAriaLabel}
        onPick={closeOnPick ? () => onClose() : undefined}
      />
      {afterOptions}
    </EzListFilterModal>
  );
}
