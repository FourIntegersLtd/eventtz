"use client";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PLANNER_COPY } from "./plannerCopy";

type PlannerGeneratingStateProps = {
  activeStepIndex: number;
};

/** C06 generating state: step labels and progress bar. */
export function PlannerGeneratingState({ activeStepIndex }: PlannerGeneratingStateProps) {
  const progress = ((activeStepIndex + 1) / PLANNER_COPY.loadingLabels.length) * 100;

  return (
    <Card>
      <Card.Body className="ez-stack">
        <ol className="ez-stack ez-stack--sm m-0 list-none p-0">
          {PLANNER_COPY.loadingLabels.map((label, index) => {
            const active = index === activeStepIndex;
            const done = index < activeStepIndex;
            return (
              <li
                key={label}
                className={active ? "ez-strong" : done ? "ez-small" : "ez-caption"}
              >
                {label}
              </li>
            );
          })}
        </ol>
        <ProgressBar percent={progress} label="Plan progress" />
      </Card.Body>
    </Card>
  );
}
