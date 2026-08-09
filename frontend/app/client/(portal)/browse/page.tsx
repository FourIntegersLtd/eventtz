"use client";

import { Suspense } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { MarketplaceExploreView } from "@/features/marketplace/MarketplaceExploreView";

function ClientBrowsePageContent() {
  const { user } = useAuth();
  return <MarketplaceExploreView embedded={user?.user_type === "client"} />;
}

export default function ClientBrowsePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading browse…" variant="centered" branded />}>
      <ClientBrowsePageContent />
    </Suspense>
  );
}
