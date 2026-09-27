"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminBookingsListView } from "@/domains/admin-commerce/AdminBookingsListView";
import { AdminFinancialsView } from "@/domains/admin-commerce/AdminFinancialsView";
import { AdminMarketplaceAnalyticsView } from "@/domains/admin-commerce/AdminMarketplaceAnalyticsView";
import { parseCommerceTab } from "@/domains/admin-commerce/commerceTab";

const TABS = [
  { value: "bookings", label: "Bookings" },
  { value: "financials", label: "Financials" },
  { value: "marketplace", label: "Marketplace" },
] as const;

type Tab = (typeof TABS)[number]["value"];

/** `/admin/commerce` — bookings, financials and marketplace analytics behind a `?tab=` pill bar. */
export function AdminCommerceView() {
  return (
    <Suspense>
      <CommerceTabs />
    </Suspense>
  );
}

function CommerceTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseCommerceTab(searchParams.get("tab")) as Tab;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => router.push(`/admin/commerce?tab=${option.value}`)}
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
      {tab === "bookings" ? <AdminBookingsListView /> : null}
      {tab === "financials" ? <AdminFinancialsView /> : null}
      {tab === "marketplace" ? <AdminMarketplaceAnalyticsView /> : null}
    </div>
  );
}
