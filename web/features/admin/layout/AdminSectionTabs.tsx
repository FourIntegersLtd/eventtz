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
  /** e.g. `/admin/commerce` - tab query is appended as `?tab=` */
  basePath: string;
};

/** Design section tabs (Bookings / Financials / Analytics, Vendors / Clients, and so on). */
export function AdminSectionTabs({ tabs, activeId, basePath }: AdminSectionTabsProps) {
  const path = basePath.replace(/\/$/, "");

  return (
    <div className="ez-tabs" role="tablist" aria-label="Section">
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        const badge = typeof tab.badge === "number" && tab.badge > 0 ? tab.badge : 0;
        return (
          <Link
            key={tab.id}
            href={`${path}?tab=${encodeURIComponent(tab.id)}`}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={selected ? "ez-tab ez-tab--active" : "ez-tab"}
          >
            {tab.label}
            {badge > 0 ? <span className="ez-tab__count">{badge > 99 ? "99+" : badge}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
