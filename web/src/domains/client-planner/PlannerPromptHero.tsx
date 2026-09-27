"use client";

/**
 * The prompt box at the top of the planner: eyebrow, headline, the example
 * placeholder, and the submit button. No icon — the rebuild has no icon package.
 */
import { Button } from "@/foundation/ui";
import { PLANNER_COPY } from "@/domains/client-planner/plannerCopy";

export interface PlannerPromptHeroProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

/** Prompt hero for `/client/planner`. */
export function PlannerPromptHero({ prompt, onPromptChange, onSubmit, loading }: PlannerPromptHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#faf8fc] via-primary-muted/30 to-primary-soft/40 px-5 py-8 text-left sm:px-8 sm:py-10">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-2xl"
        aria-hidden
      />
      <p className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
        {PLANNER_COPY.heroEyebrow}
      </p>
      <h1 className="mt-2 text-left font-heading text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
        {PLANNER_COPY.heroHeadline}
      </h1>
      <p className="mt-3 max-w-xl text-left text-sm leading-relaxed text-neutral-600 sm:text-base">
        {PLANNER_COPY.heroSupport}
      </p>
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{PLANNER_COPY.promptLabel}</span>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={3}
            maxLength={2000}
            disabled={loading}
            placeholder={PLANNER_COPY.promptPlaceholder}
            className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 disabled:opacity-60 md:text-sm"
          />
        </label>
        <Button type="submit" loading={loading} disabled={loading || !prompt.trim()} className="shrink-0 sm:mb-0.5">
          {PLANNER_COPY.submitLabel}
        </Button>
      </form>
    </section>
  );
}
