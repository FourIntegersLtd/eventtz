"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
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
  { id: "marketplace", label: "Analytics" },
] as const;

function CommerceScreen() {
  const searchParams = useSearchParams();
  const [financialsActions, setFinancialsActions] = useState<ReactNode | null>(null);
  const tab = useMemo((): "bookings" | "financials" | "marketplace" => {
    const value = searchParams.get("tab");
    if (value === "financials") return "financials";
    if (value === "marketplace") return "marketplace";
    return "bookings";
  }, [searchParams]);

  const title =
    tab === "financials" ? "Financials" : tab === "marketplace" ? "Marketplace analytics" : "Bookings";
  const description =
    tab === "financials"
      ? "Money taken, fees, and what is still held."
      : tab === "marketplace"
        ? "Marketplace health for this period."
        : "Request status and payment status are separate.";

  return (
    <AdminConsolePage

      title={title}
      description={description}
      actions={tab === "financials" ? financialsActions : undefined}
    >
      <AdminSectionTabs tabs={TABS} activeId={tab} basePath="/admin/commerce" />
      {tab === "financials" ? (
        <AdminFinancialsView onRegisterPageActions={setFinancialsActions} />
      ) : tab === "marketplace" ? (
        <AdminMarketplaceAnalyticsView />
      ) : (
        <AdminBookingsView />
      )}
    </AdminConsolePage>
  );
}

export default function AdminCommercePage() {
  return (
    <Suspense
      fallback={
        <AdminConsolePage title="Bookings">
          <AdminLoadingState />
        </AdminConsolePage>
      }
    >
      <CommerceScreen />
    </Suspense>
  );
}
