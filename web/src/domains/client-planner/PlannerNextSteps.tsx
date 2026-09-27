/**
 * "Suggested next steps": the short ordered list the api works out from the
 * plan's recommendations (`next_steps`). Renders nothing when the list is
 * empty, as in the baseline.
 */
export function PlannerNextSteps({ steps }: { steps: readonly string[] }) {
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
