"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSectionTabs } from "@/features/admin/layout/AdminSectionTabs";
import { AdminBookingsView } from "@/features/admin/bookings/AdminBookingsView";
import { AdminFinancialsView } from "@/features/admin/financials/AdminFinancialsView";
import { AdminMarketplaceAnalyticsView } from "@/features/admin/marketplace/AdminMarketplaceAnalyticsView";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";

const TABS = [
  { id: "bookings", label: "Bookings" },
  { id: "financials", label: "Financials" },
  { id: "marketplace", label: "Marketplace" },
] as const;

function CommerceTabs() {
  const searchParams = useSearchParams();
  const tab = useMemo((): "bookings" | "financials" | "marketplace" => {
    const t = searchParams.get("tab");
    if (t === "financials") return "financials";
    if (t === "marketplace") return "marketplace";
    return "bookings";
  }, [searchParams]);

  return (
    <>
      <AdminSectionTabs tabs={TABS} activeId={tab} basePath="/admin/commerce" />
      {tab === "financials" ? (
        <AdminFinancialsView />
      ) : tab === "marketplace" ? (
        <AdminMarketplaceAnalyticsView />
      ) : (
        <AdminBookingsView />
      )}
    </>
  );
}

export default function AdminCommercePage() {
  return (
    <AdminConsolePage title="Commerce">
      <Suspense fallback={<AdminLoadingState />}>
        <CommerceTabs />
      </Suspense>
    </AdminConsolePage>
  );
}
