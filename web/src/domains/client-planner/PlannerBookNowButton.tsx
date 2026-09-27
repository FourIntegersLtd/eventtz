"use client";

/**
 * Book now for one recommended vendor.
 *
 * When the plan has no client event yet, this calls ensure-event first, then
 * opens `/client/browse/{vendorUserId}` with the plan's query params. A ref
 * ignores a second click while that request is in flight. The launching-soon
 * gate from the baseline is not wired here: it is a frontend flag plus an
 * email allowlist, not data the API exposes.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/foundation/ui";
import { ensurePlanClientEvent, type PlanDetail } from "@/domains/client-planner/api";
import { buildPlannerVendorBookUrl } from "@/domains/client-planner/bookUrl";
import { BOOK_NOW_FAILED, PLANNER_COPY } from "@/domains/client-planner/plannerCopy";

export interface PlannerBookNowButtonProps {
  plan: PlanDetail;
  vendorUserId: string;
}

/** Starts a booking from a recommended vendor. */
export function PlannerBookNowButton({ plan, vendorUserId }: PlannerBookNowButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function startBooking() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy(true);
    try {
      const existingEventId = plan.client_event_id?.trim() ?? "";
      const eventId = existingEventId
        ? existingEventId
        : (await ensurePlanClientEvent(plan.plan_id)).event_id;
      router.push(buildPlannerVendorBookUrl(vendorUserId, plan, eventId));
    } catch {
      setError(BOOK_NOW_FAILED);
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button type="button" loading={busy} disabled={busy} onClick={() => void startBooking()}>
        {PLANNER_COPY.bookNowLabel}
      </Button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
