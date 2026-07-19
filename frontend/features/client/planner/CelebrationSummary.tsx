"use client";

import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";
import { celebrationMetaLine } from "./plannerModel";

type CelebrationSummaryProps = {
  plan: CelebrationPlanResponse;
};

export function CelebrationSummary({ plan }: CelebrationSummaryProps) {
  const meta = celebrationMetaLine(plan);
  return (
    <header className="min-w-0">
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        {plan.celebration.title}
      </h2>
      {meta ? <p className="mt-1.5 text-sm text-neutral-600">{meta}</p> : null}
      {plan.celebration.summary ? (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-700">
          {plan.celebration.summary}
        </p>
      ) : null}
      {plan.brief.currency_assumed_gbp ? (
        <p className="mt-2 text-xs text-neutral-500">Budget amounts shown in GBP.</p>
      ) : null}
      {plan.brief.preferred_date_invalid ? (
        <p className="mt-2 text-xs text-amber-800">
          The date in your prompt looks past or invalid — confirm dates when you enquire.
        </p>
      ) : null}
      {plan.brief.unsupported_categories_mentioned?.length ? (
        <p className="mt-2 text-xs text-neutral-500">
          We don’t list {plan.brief.unsupported_categories_mentioned.join(", ")} as dedicated
          categories yet — recommendations use catering, cake, photos, makeup, and rentals.
        </p>
      ) : null}
    </header>
  );
}
