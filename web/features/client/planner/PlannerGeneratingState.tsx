"use client";

import { PLANNER_COPY } from "./plannerCopy";

type PlannerGeneratingStateProps = {
  activeStepIndex: number;
};

/** C06 generating state: step labels and progress bar. */
export function PlannerGeneratingState({ activeStepIndex }: PlannerGeneratingStateProps) {
  const progress = ((activeStepIndex + 1) / PLANNER_COPY.loadingLabels.length) * 100;

  return (
    <div className="ez-card">
      <div className="ez-card__body ez-stack">
        <ol className="ez-stack ez-stack--sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {PLANNER_COPY.loadingLabels.map((label, index) => {
            const active = index === activeStepIndex;
            const done = index < activeStepIndex;
            return (
              <li
                key={label}
                className={active ? "ez-strong" : done ? "ez-small" : "ez-caption"}
                style={{ color: active ? undefined : done ? "var(--ez-ink-2)" : undefined }}
              >
                {label}
              </li>
            );
          })}
        </ol>
        <div className="ez-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="ez-progress__bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
