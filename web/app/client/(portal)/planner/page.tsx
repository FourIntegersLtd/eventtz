"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { AiPlannerView } from "@/features/client/planner/AiPlannerView";

export default function ClientPlannerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading planner…" variant="centered" className="py-16" />}>
      <AiPlannerView />
    </Suspense>
  );
}
