"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { FOCUS_RING, TOUCH_TARGET } from "@/components/ui/tokens";
import {
  ADMIN_PERIOD_OPTIONS,
  type AdminPeriodDays,
} from "@/features/admin/commerce/commercePeriod";

type AdminCommercePeriodFilterProps = {
  period: AdminPeriodDays;
  onPeriodChange: (period: AdminPeriodDays) => void;
  className?: string;
  /** Dropdown alignment relative to the button. Default right (admin toolbars). */
  menuAlign?: "left" | "right";
};

/**
 * Compact date-range control (Shopify / Mixpanel style):
 * one button labelled with the active preset; menu for Last 7/30/60/90.
 */
export function AdminCommercePeriodFilter({
  period,
  onPeriodChange,
  className = "",
  menuAlign = "right",
}: AdminCommercePeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected =
    ADMIN_PERIOD_OPTIONS.find((o) => o.value === period) ?? ADMIN_PERIOD_OPTIONS[1];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50 ${FOCUS_RING}`}
      >
        <CalendarDays className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
        {selected.label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-neutral-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Reporting period"
          className={`absolute top-full z-30 mt-1.5 min-w-[11.5rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-md ${
            menuAlign === "left" ? "left-0" : "right-0"
          }`}
        >
          {ADMIN_PERIOD_OPTIONS.map((opt) => {
            const active = opt.value === period;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onPeriodChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-neutral-50 ${
                    active ? "font-medium text-neutral-900" : "text-neutral-700"
                  } ${TOUCH_TARGET}`}
                >
                  {opt.label}
                  {active ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
