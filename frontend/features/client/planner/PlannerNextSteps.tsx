"use client";

type PlannerNextStepsProps = {
  steps: string[];
};

export function PlannerNextSteps({ steps }: PlannerNextStepsProps) {
  if (!steps.length) return null;
  return (
    <section className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-neutral-900">Suggested next steps</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
