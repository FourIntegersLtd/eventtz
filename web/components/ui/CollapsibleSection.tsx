"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { CARD_SURFACE } from "@/components/ui/tokens";

export type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  /** When true, panel starts expanded. */
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  badge,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={`overflow-hidden ${CARD_SURFACE} ${className}`.trim()}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-3"
      >
        <div className="min-w-0">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-snug text-ink-3">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge != null && badge !== "" ? (
            <span className="max-w-[8rem] truncate rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-2 sm:max-w-none">
              {badge}
            </span>
          ) : null}
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </div>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-line px-4 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
