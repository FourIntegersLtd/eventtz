"use client";

import Link from "next/link";

export type AdminSectionTab = {
  id: string;
  label: string;
};

type AdminSectionTabsProps = {
  tabs: readonly AdminSectionTab[];
  activeId: string;
  /** e.g. `/admin/commerce` — tab query is appended as `?tab=` */
  basePath: string;
};

export function AdminSectionTabs({ tabs, activeId, basePath }: AdminSectionTabsProps) {
  const path = basePath.replace(/\/$/, "");

  return (
    <div
      className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1"
      role="tablist"
      aria-label="Section"
    >
      {tabs.map((t) => {
        const selected = t.id === activeId;
        return (
          <Link
            key={t.id}
            href={`${path}?tab=${encodeURIComponent(t.id)}`}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              selected
                ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
