"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSectionTabs } from "@/features/admin/layout/AdminSectionTabs";
import { AdminVendorsView } from "@/features/admin/vendors/AdminVendorsView";
import { AdminClientsView } from "@/features/admin/clients/AdminClientsView";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";

const TABS = [
  { id: "vendors", label: "Vendors" },
  { id: "clients", label: "Clients" },
] as const;

function DirectoryTabs() {
  const searchParams = useSearchParams();
  const tab = useMemo((): "vendors" | "clients" => {
    const t = searchParams.get("tab");
    return t === "clients" ? "clients" : "vendors";
  }, [searchParams]);

  return (
    <>
      <AdminSectionTabs tabs={TABS} activeId={tab} basePath="/admin/directory" />
      {tab === "clients" ? <AdminClientsView /> : <AdminVendorsView />}
    </>
  );
}

export default function AdminDirectoryPage() {
  return (
    <AdminConsolePage title="Directory">
      <Suspense fallback={<AdminLoadingState />}>
        <DirectoryTabs />
      </Suspense>
    </AdminConsolePage>
  );
}
