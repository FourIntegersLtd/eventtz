import { Check } from "lucide-react";

export type StepperProps = {
  /** Step labels in order. */
  steps: readonly string[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string;
};

/** Horizontal progress steps (`ez-stepper`): done steps show a tick, the current one a halo. */
export function Stepper({ steps, current, className = "" }: StepperProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="ez-stepper" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((label, index) => {
          const state = index < current ? " ez-step--done" : index === current ? " ez-step--current" : "";
          return (
            <li key={label} className={`ez-step${state}`} aria-current={index === current ? "step" : undefined}>
              <span className="ez-step__dot">
                {index < current ? <Check aria-hidden strokeWidth={2.5} /> : index + 1}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
