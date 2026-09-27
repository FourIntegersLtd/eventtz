/**
 * The plan's title, meta line, and summary, including the baseline's notes
 * about assumed GBP, an invalid date, and categories we don't list.
 */
import type { PlanDetail } from "@/domains/client-planner/api";
import { PLANNER_COPY } from "@/domains/client-planner/plannerCopy";
import { celebrationMetaLine } from "@/domains/client-planner/plannerModel";

/** Headline block for a loaded celebration plan. */
export function CelebrationSummary({ plan }: { plan: PlanDetail }) {
  const meta = celebrationMetaLine(plan);
  const unsupported = plan.brief.unsupported_categories_mentioned ?? [];
  return (
    <header className="min-w-0">
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        {plan.celebration.title}
      </h2>
      {meta ? <p className="mt-1.5 text-sm text-neutral-600">{meta}</p> : null}
      {plan.celebration.summary ? (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-700">{plan.celebration.summary}</p>
      ) : null}
      {plan.brief.currency_assumed_gbp ? (
        <p className="mt-2 text-xs text-neutral-500">{PLANNER_COPY.currencyAssumed}</p>
      ) : null}
      {plan.brief.preferred_date_invalid ? (
        <p className="mt-2 text-xs text-amber-800">{PLANNER_COPY.invalidDate}</p>
      ) : null}
      {unsupported.length ? (
        <p className="mt-2 text-xs text-neutral-500">
          We don&apos;t list {unsupported.join(", ")} as dedicated categories yet — try browsing related
          vendors or contact us for help.
        </p>
      ) : null}
    </header>
  );
}
