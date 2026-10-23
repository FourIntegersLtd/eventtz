"use client";

import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { CelebrationPlanListItem } from "@/lib/clientPlannerApi";
import { PLANNER_COPY } from "./plannerCopy";

type PlannerSavedPlansListProps = {
  plans: CelebrationPlanListItem[];
};

function planCaption(plan: CelebrationPlanListItem): string {
  const parts: string[] = [];
  if (plan.location) parts.push(plan.location);
  if (plan.event_type) parts.push(plan.event_type.replace(/_/g, " "));
  return parts.join(" · ");
}

/** C06 saved plans list (`ez-list`). */
export function PlannerSavedPlansList({ plans }: PlannerSavedPlansListProps) {
  if (!plans.length) {
    return (
      <div className="ez-stack ez-stack--sm">
        <span className="ez-h3">{PLANNER_COPY.savedPlansTitle}</span>
        <p className="ez-caption">{PLANNER_COPY.emptyPlans}</p>
      </div>
    );
  }

  return (
    <div className="ez-stack ez-stack--sm">
      <span className="ez-h3">{PLANNER_COPY.savedPlansTitle}</span>
      <div className="ez-list">
        {plans.slice(0, 8).map((plan) => (
          <div key={plan.plan_id} className="ez-list-row">
            <span className="ez-icon-tile" aria-hidden>
              <Sparkles width={22} height={22} strokeWidth={1.75} />
            </span>
            <div className="ez-list-row__main">
              <span className="ez-strong">{plan.title}</span>
              <span className="ez-caption">{planCaption(plan) || "Saved plan"}</span>
            </div>
            <ButtonLink
              href={`/client/planner/${encodeURIComponent(plan.plan_id)}`}
              variant="secondary"
              size="sm"
            >
              Open
            </ButtonLink>
          </div>
        ))}
      </div>
    </div>
  );
}
