import { Suspense } from "react";
import { LoadingState } from "@/foundation/ui";
import { AiPlannerView } from "@/domains/client-planner/AiPlannerView";

/**
 * `/client/planner` — describe a celebration and generate a plan.
 * The view reads `?q=`, so it sits inside Suspense.
 */
export default function ClientPlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingState variant="inline" label="Loading planner…" />
        </div>
      }
    >
      <AiPlannerView />
    </Suspense>
  );
}
