"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { buildPlannerVendorBookUrl } from "@/features/bookings/eventEnquirePrefill";
import { useLaunchingSoonBookingGuard } from "@/features/bookings/useLaunchingSoonBookingGuard";
import { ensurePlanClientEvent } from "@/lib/clientPlannerApi";
import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";
import { PLANNER_COPY } from "./plannerCopy";

type PlannerBookNowButtonProps = {
  plan: CelebrationPlanResponse;
  vendorUserId: string;
};

export function PlannerBookNowButton({ plan, vendorUserId }: PlannerBookNowButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { guardBooking, launchingSoonModal } = useLaunchingSoonBookingGuard();

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={busy}
        disabled={busy}
        onClick={() => {
          guardBooking(() => {
            setError(null);
            setBusy(true);
            void (async () => {
              try {
                const ensured = plan.client_event_id
                  ? { event_id: plan.client_event_id }
                  : await ensurePlanClientEvent(plan.plan_id);
                router.push(buildPlannerVendorBookUrl(vendorUserId, plan, ensured.event_id));
              } catch {
                setError("Could not start booking. Try again.");
                setBusy(false);
              }
            })();
          });
        }}
      >
        {PLANNER_COPY.bookNowLabel}
      </Button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
      {launchingSoonModal}
    </div>
  );
}
