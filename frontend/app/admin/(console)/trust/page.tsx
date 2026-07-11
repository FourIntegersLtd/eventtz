"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSectionTabs } from "@/features/admin/layout/AdminSectionTabs";
import { AdminDisputesView } from "@/features/admin/disputes/AdminDisputesView";
import { AdminReviewsView } from "@/features/admin/reviews/AdminReviewsView";
import { AdminChatLookupView } from "@/features/admin/chat/AdminChatLookupView";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";

const TABS = [
  { id: "disputes", label: "Disputes" },
  { id: "reviews", label: "Reviews" },
  { id: "chat", label: "Chat lookup" },
] as const;

function TrustTabs() {
  const searchParams = useSearchParams();
  const tab = useMemo((): "disputes" | "reviews" | "chat" => {
    const t = searchParams.get("tab");
    if (t === "reviews") return "reviews";
    if (t === "chat") return "chat";
    return "disputes";
  }, [searchParams]);

  return (
    <>
      <AdminSectionTabs tabs={TABS} activeId={tab} basePath="/admin/trust" />
      {tab === "reviews" ? (
        <AdminReviewsView />
      ) : tab === "chat" ? (
        <AdminChatLookupView />
      ) : (
        <AdminDisputesView />
      )}
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
