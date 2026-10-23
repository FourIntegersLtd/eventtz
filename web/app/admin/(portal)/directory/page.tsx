"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSectionTabs } from "@/features/admin/layout/AdminSectionTabs";
import { AdminVendorsView } from "@/features/admin/vendors/AdminVendorsView";
import { parseVendorQueueTab } from "@/features/admin/vendors/adminVendorQueueStatus";
import { AdminClientsView } from "@/features/admin/clients/AdminClientsView";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";

const TABS = [
  { id: "vendors", label: "Vendors" },
  { id: "clients", label: "Clients" },
] as const;

function DirectoryScreen() {
  const searchParams = useSearchParams();
  const tab = useMemo((): "vendors" | "clients" => {
    return searchParams.get("tab") === "clients" ? "clients" : "vendors";
  }, [searchParams]);

  return (
    <AdminConsolePage

      title={tab === "clients" ? "Clients" : "Vendors"}
      description={
        tab === "clients"
          ? "Client accounts."
          : "Review queue, returned and draft applications, approved vendors, and suspensions."
      }
    >
      <AdminSectionTabs tabs={TABS} activeId={tab} basePath="/admin/directory" />
      {tab === "clients" ? (
        <AdminClientsView />
      ) : (
        <AdminVendorsView initialQueueTab={parseVendorQueueTab(searchParams.get("queue"))} />
      )}
    </AdminConsolePage>
  );
}

export default function AdminDirectoryPage() {
  return (
    <Suspense
      fallback={
        <AdminConsolePage title="Vendors">
          <AdminLoadingState />
        </AdminConsolePage>
      }
    >
      <DirectoryScreen />
    </Suspense>
  );
}
