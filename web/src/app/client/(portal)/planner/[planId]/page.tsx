import { Suspense } from "react";
import { LoadingState } from "@/foundation/ui";
import { AiPlannerView } from "@/domains/client-planner/AiPlannerView";

type PageProps = {
  params: Promise<{ planId: string }>;
};

/**
 * `/client/planner/[planId]` — one saved celebration plan.
 * `key` remounts the view when the id changes so a new plan is loaded cleanly.
 */
export default async function ClientPlannerDetailPage({ params }: PageProps) {
  const { planId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingState variant="inline" label="Loading plan…" />
        </div>
      }
    >
      <AiPlannerView key={planId} initialPlanId={planId} />
    </Suspense>
  );
}
