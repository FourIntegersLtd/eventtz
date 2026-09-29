"use client";

/** VendorProfileSectionTabs for the vendor onboarding wizard. */

import Link from "next/link";
import { useEffect, useRef } from "react";
import { STEP_LABELS } from "./constants";

type VendorProfileSectionTabsProps = {
  step: number;
  reviewsActive: boolean;
  onNavigateToStep: (step: number) => void;
  /** `horizontal` = scrollable pill row (mobile); `vertical` = sidebar list (desktop). */
  orientation?: "horizontal" | "vertical";
};

const CONTAINER_CLASS: Record<"horizontal" | "vertical", string> = {
  horizontal:
    "flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
  vertical: "flex flex-col space-y-0.5 overflow-hidden rounded-2xl border border-neutral-100 bg-white p-2",
};

const ITEM_CLASS: Record<"horizontal" | "vertical", (active: boolean) => string> = {
  horizontal: (active) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-lg px-3.5 py-2 text-sm font-medium transition ${
      active
        ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
        : "text-neutral-600 hover:text-neutral-900"
    }`,
  vertical: (active) =>
    `inline-flex shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50 ${
      active
        ? "bg-primary/10 text-primary"
        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
    }`,
};

/**
 * Every section a vendor can jump to from their live profile: onboarding steps 1-8
 * plus the reviews page. One list drives both the mobile pill row and the desktop
 * sidebar so a new section only needs to be added here.
 */
export function VendorProfileSectionTabs({
  step,
  reviewsActive,
  onNavigateToStep,
  orientation = "horizontal",
}: VendorProfileSectionTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (orientation !== "horizontal") return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [step, reviewsActive, orientation]);

  const itemClass = ITEM_CLASS[orientation];

  return (
    <div
      ref={listRef}
      className={CONTAINER_CLASS[orientation]}
      role="tablist"
      aria-label="Profile sections"
    >
      {STEP_LABELS.slice(0, 8).map((label, i) => {
        const n = i + 1;
        const active = !reviewsActive && n === step;
        return (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active ? "true" : undefined}
            onClick={() => onNavigateToStep(n)}
            className={itemClass(active)}
          >
            {label}
          </button>
        );
      })}
      {orientation === "vertical" ? (
        <div className="my-1.5 border-t border-neutral-100" aria-hidden />
      ) : null}
      <Link
        href="/vendor/profile/reviews"
        role="tab"
        aria-selected={reviewsActive}
        data-active={reviewsActive ? "true" : undefined}
        className={itemClass(reviewsActive)}
      >
        Client reviews
      </Link>
    </div>
  );
}
