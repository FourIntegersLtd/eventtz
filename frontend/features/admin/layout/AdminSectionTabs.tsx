"use client";

import Link from "next/link";

export type AdminSectionTab = {
  id: string;
  label: string;
  /** Optional unread / count pill (Messages inbox, etc.). */
  badge?: number;
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
      className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch]"
      role="tablist"
      aria-label="Section"
    >
      {tabs.map((t) => {
        const selected = t.id === activeId;
        const badge = typeof t.badge === "number" && t.badge > 0 ? t.badge : 0;
        return (
          <Link
            key={t.id}
            href={`${path}?tab=${encodeURIComponent(t.id)}`}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              selected
                ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {t.label}
            {badge > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
