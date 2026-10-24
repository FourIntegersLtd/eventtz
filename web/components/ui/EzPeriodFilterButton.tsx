"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";

type PeriodOption<T extends string | number> = {
  value: T;
  label: string;
};

type EzPeriodFilterButtonProps<T extends string | number> = {
  options: readonly PeriodOption<T>[];
  value: T;
  onChange: (value: T) => void;
  defaultValue: T;
  title?: string;
  listAriaLabel?: string;
  className?: string;
  size?: "default" | "sm";
};

/** Reporting-period control: one button opens the shared filter modal. */
export function EzPeriodFilterButton<T extends string | number>({
  options,
  value,
  onChange,
  defaultValue,
  title = "Reporting period",
  listAriaLabel = "Reporting period",
  className = "",
  size = "sm",
}: EzPeriodFilterButtonProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const modalOptions: EzFilterOption<string>[] = options.map((option) => ({
    id: String(option.value),
    title: option.label,
  }));

  const sizeClass = size === "sm" ? "ez-btn--sm" : "";

  return (
    <>
      <button
        type="button"
        className={`ez-btn ez-btn--secondary shrink-0 ${sizeClass} ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <CalendarDays className="h-3.5 w-3.5 text-ink-3" aria-hidden />
        {selected.label}
      </button>
      <EzFilterOptionsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        description="Choose how far back charts and totals should look."
        options={modalOptions}
        value={String(value)}
        onChange={(id) => {
          const match = options.find((option) => String(option.value) === id);
          if (match) onChange(match.value);
        }}
        listAriaLabel={listAriaLabel}
        resetValue={String(defaultValue)}
        resetLabel={`Reset to ${options.find((o) => o.value === defaultValue)?.label ?? "default"}`}
      />
    </>
  );
}
