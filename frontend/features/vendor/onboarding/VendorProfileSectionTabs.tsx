"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { STEP_LABELS } from "./constants";

type VendorProfileSectionTabsProps = {
  step: number;
  reviewsActive: boolean;
  onNavigateToStep: (step: number) => void;
};

export function VendorProfileSectionTabs({
  step,
  reviewsActive,
  onNavigateToStep,
}: VendorProfileSectionTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [step, reviewsActive]);

  const tabClass = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-lg px-3.5 py-2 text-sm font-medium transition ${
      active
        ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
        : "text-neutral-600 hover:text-neutral-900"
    }`;

  return (
    <div
      ref={listRef}
      className="flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
            className={tabClass(active)}
          >
            {label}
          </button>
        );
      })}
      <Link
        href="/vendor/profile/reviews"
        role="tab"
        aria-selected={reviewsActive}
        data-active={reviewsActive ? "true" : undefined}
        className={tabClass(reviewsActive)}
      >
        Client reviews
      </Link>
    </div>
  );
}
