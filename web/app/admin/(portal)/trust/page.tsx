"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSectionTabs } from "@/features/admin/layout/AdminSectionTabs";
import { AdminDisputesView } from "@/features/admin/disputes/AdminDisputesView";
import { AdminReviewsView } from "@/features/admin/reviews/AdminReviewsView";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";

const TABS = [
  { id: "disputes", label: "Disputes" },
  { id: "reviews", label: "Reviews" },
] as const;

function TrustScreen() {
  const searchParams = useSearchParams();
  const tab = useMemo((): "disputes" | "reviews" => {
    return searchParams.get("tab") === "reviews" ? "reviews" : "disputes";
  }, [searchParams]);

  return (
    <AdminConsolePage

      title={tab === "reviews" ? "Reviews" : "Disputes"}
      description={
        tab === "reviews"
          ? "Moderate published and hidden reviews."
          : "Funds stay held until a decision is recorded."
      }
    >
      <AdminSectionTabs tabs={TABS} activeId={tab} basePath="/admin/trust" />
      {tab === "reviews" ? <AdminReviewsView /> : <AdminDisputesView />}
    </AdminConsolePage>
  );
}

export default function AdminTrustPage() {
  return (
    <Suspense
      fallback={
        <AdminConsolePage title="Disputes">
          <AdminLoadingState />
        </AdminConsolePage>
      }
    >
      <TrustScreen />
    </Suspense>
  );
}
