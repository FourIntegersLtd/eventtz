"use client";

import { Suspense, use } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { AiPlannerView } from "@/features/client/planner/AiPlannerView";

export default function ClientPlannerDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  return (
    <Suspense fallback={<LoadingState label="Loading plan…" variant="centered" className="py-16" />}>
      <AiPlannerView initialPlanId={planId} />
    </Suspense>
  );
}
