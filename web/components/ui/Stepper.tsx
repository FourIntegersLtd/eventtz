export type StepperProps = {
  /** Step labels in order. */
  steps: readonly string[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string;
};

/** Horizontal progress steps; on small screens only the active label shows, with "Step n of N". */
export function Stepper({ steps, current, className = "" }: StepperProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <p className="text-xs font-medium text-ink-3 sm:hidden">
        Step {Math.min(current + 1, steps.length)} of {steps.length}: {steps[current]}
      </p>
      <ol className="flex items-center gap-2 sm:gap-3">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                  done
                    ? "border-primary bg-primary text-white"
                    : active
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line-strong bg-white text-ink-3"
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`hidden truncate text-sm font-medium sm:block ${
                  active ? "text-ink" : "text-ink-3"
                }`}
              >
                {label}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={`h-px flex-1 ${done ? "bg-primary" : "bg-line-strong"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
