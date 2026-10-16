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

function TrustTabs() {
  const searchParams = useSearchParams();
  const tab = useMemo((): "disputes" | "reviews" => {
    const t = searchParams.get("tab");
    if (t === "reviews") return "reviews";
    return "disputes";
  }, [searchParams]);

  return (
    <>
      <AdminSectionTabs tabs={TABS} activeId={tab} basePath="/admin/trust" />
      {tab === "reviews" ? <AdminReviewsView /> : <AdminDisputesView />}
    </>
  );
}

export default function AdminTrustPage() {
  return (
    <AdminConsolePage title="Trust & safety">
      <Suspense fallback={<AdminLoadingState />}>
        <TrustTabs />
      </Suspense>
    </AdminConsolePage>
  );
}
