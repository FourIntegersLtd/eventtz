"use client";

import Link from "next/link";

export type SettingsTab = {
  id: string;
  label: string;
};

type SettingsTabsProps = {
  tabs: readonly SettingsTab[];
  activeId: string;
  basePath: string;
};

export function SettingsTabs({ tabs, activeId, basePath }: SettingsTabsProps) {
  const path = basePath.replace(/\/$/, "");

  return (
    <div
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch]"
      role="tablist"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            href={`${path}?tab=${encodeURIComponent(tab.id)}`}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              selected
                ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
