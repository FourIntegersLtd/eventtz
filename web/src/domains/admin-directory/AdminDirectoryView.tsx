"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminVendorsPanel } from "@/domains/admin-directory/AdminVendorsPanel";
import { AdminClientsPanel } from "@/domains/admin-directory/AdminClientsPanel";

const TABS = [
  { value: "vendors", label: "Vendors" },
  { value: "clients", label: "Clients" },
] as const;

type Tab = (typeof TABS)[number]["value"];

/** `/admin/directory` — vendors and clients behind a `?tab=` pill bar, matching the baseline's tab set. */
export function AdminDirectoryView() {
  return (
    <Suspense>
      <DirectoryTabs />
    </Suspense>
  );
}

function DirectoryTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "vendors";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => router.push(`/admin/directory?tab=${option.value}`)}
            className={
              tab === option.value
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      {tab === "vendors" ? <AdminVendorsPanel /> : null}
      {tab === "clients" ? <AdminClientsPanel /> : null}
    </div>
  );
}
