"use client";

/**
 * The AI celebration planner: prompt, recent plans, and a loaded plan.
 *
 * Generating calls a language model and can take a while. The rotating status
 * is its own component, mounted only while a request is in flight, so the
 * tick starts at zero without a setState in this component's effect.
 * Mixpanel events from the baseline are not sent.
 */
import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Spinner } from "@/foundation/ui";
import { platformErrorDetail } from "@/foundation/platform-client";
import { ensurePlanClientEvent } from "@/domains/client-planner/api";
import { BROWSE_HANDOFF_FAILED, PLANNER_COPY } from "@/domains/client-planner/plannerCopy";
import {
  buildPlannerBrowseUrl,
  primaryVendorsFromPlan,
  recentPlanSubtitle,
} from "@/domains/client-planner/plannerModel";
import { BudgetBreakdown } from "@/domains/client-planner/BudgetBreakdown";
import { CelebrationSummary } from "@/domains/client-planner/CelebrationSummary";
import { ConfidenceBadge } from "@/domains/client-planner/ConfidenceBadge";
import { PlannerPromptHero } from "@/domains/client-planner/PlannerPromptHero";
import { RecommendationSection } from "@/domains/client-planner/RecommendationSection";
import { useGeneratePlan } from "@/domains/client-planner/useGeneratePlan";

/** Rotating "still working" label. Remount (via `key`) to start again at the first sentence. */
function PlannerLoadingStatus() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((current) => (current + 1) % PLANNER_COPY.loadingLabels.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);
  const label = PLANNER_COPY.loadingLabels[tick] ?? PLANNER_COPY.loadingLabels[0];
  return (
    <div className="flex justify-center py-16">
      <Spinner label={label} />
    </div>
  );
}

/** `/client/planner` and `/client/planner/[planId]`. */
export function AiPlannerView({ initialPlanId }: { initialPlanId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptFromUrl = searchParams.get("q")?.trim() || "";
  const [prompt, setPrompt] = useState(promptFromUrl);
  const [browseHandoffBusy, setBrowseHandoffBusy] = useState(false);
  const [browseHandoffError, setBrowseHandoffError] = useState<string | null>(null);
  const handoffLock = useRef(false);

  const {
    loading,
    loadingSession,
    replacingNeedId,
    error,
    simpleIntent,
    plan,
    recentPlans,
    generate,
    loadPlan,
    replaceNeed,
    refreshList,
  } = useGeneratePlan();

  const onMount = useEffectEvent(() => {
    void refreshList();
    if (initialPlanId) {
      void loadPlan(initialPlanId);
    } else if (promptFromUrl) {
      void generate(promptFromUrl);
    }
  });

  useEffect(() => {
    onMount();
  }, [initialPlanId]);

  useEffect(() => {
    if (plan?.plan_id && plan.plan_id !== initialPlanId) {
      router.replace(`/client/planner/${plan.plan_id}`);
    }
  }, [plan?.plan_id, initialPlanId, router]);

  const hasBrowseHandoff = plan ? primaryVendorsFromPlan(plan).length > 0 : false;

  async function handleBrowseHandoff() {
    if (!plan || handoffLock.current) return;
    handoffLock.current = true;
    setBrowseHandoffError(null);
    setBrowseHandoffBusy(true);
    try {
      const existingEventId = plan.client_event_id?.trim() ?? "";
      const eventId = existingEventId ? existingEventId : (await ensurePlanClientEvent(plan.plan_id)).event_id;
      router.push(buildPlannerBrowseUrl(plan, eventId));
    } catch (cause: unknown) {
      setBrowseHandoffError(platformErrorDetail(cause) ?? BROWSE_HANDOFF_FAILED);
      setBrowseHandoffBusy(false);
      handoffLock.current = false;
    }
  }

  return (
    <div className="w-full max-w-5xl space-y-8">
      <PlannerPromptHero
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={() => {
          void generate(prompt);
        }}
        loading={loading && !plan}
      />

      {simpleIntent ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>{error || PLANNER_COPY.simpleIntentHint}</p>
          <Link
            href={`/client/browse?q=${encodeURIComponent(prompt.trim())}`}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-muted"
          >
            {PLANNER_COPY.browseCta}
          </Link>
        </div>
      ) : null}

      {error && !simpleIntent ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>
      ) : null}

      {loading && !plan ? <PlannerLoadingStatus key={loadingSession} /> : null}

      {plan ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-start">
            <CelebrationSummary plan={plan} />
            <ConfidenceBadge score={plan.confidence.score} reasons={plan.confidence.reasons ?? []} />
          </div>

          {hasBrowseHandoff ? (
            <div className="rounded-2xl border border-primary/15 bg-[#faf8fc] px-5 py-4">
              <p className="text-sm text-neutral-800">{PLANNER_COPY.browseRecommendationsHint}</p>
              {browseHandoffError ? <p className="mt-2 text-sm text-red-800">{browseHandoffError}</p> : null}
              <Button
                type="button"
                className="mt-3"
                loading={browseHandoffBusy}
                disabled={browseHandoffBusy}
                onClick={() => void handleBrowseHandoff()}
              >
                {PLANNER_COPY.browseRecommendationsLabel}
              </Button>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
            <div className="space-y-5">
              <h3 className="font-heading text-xl font-semibold text-neutral-900">{PLANNER_COPY.recommendedHeading}</h3>
              {plan.recommendations.map((recommendation) => (
                <RecommendationSection
                  key={recommendation.need_id}
                  plan={plan}
                  recommendation={recommendation}
                  replacing={replacingNeedId === recommendation.need_id}
                  onReplace={() => void replaceNeed(recommendation.need_id)}
                />
              ))}
            </div>
            <div className="space-y-5 lg:sticky lg:top-20">
              <BudgetBreakdown budget={plan.budget} />
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !plan && recentPlans.length ? (
        <section>
          <h3 className="font-heading text-lg font-semibold text-neutral-900">{PLANNER_COPY.recentPlansHeading}</h3>
          <ul className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-100 bg-white">
            {recentPlans.slice(0, 8).map((item) => (
              <li key={item.plan_id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-neutral-50"
                  onClick={() => {
                    router.push(`/client/planner/${item.plan_id}`);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-900">{item.title}</span>
                    <span className="text-xs text-neutral-500">{recentPlanSubtitle(item)}</span>
                  </span>
                  {item.confidence_score != null ? (
                    <span className="shrink-0 text-xs tabular-nums text-neutral-500">{item.confidence_score}%</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !plan && !recentPlans.length && !error ? (
        <p className="text-left text-sm text-neutral-500">{PLANNER_COPY.emptyPlans}</p>
      ) : null}

      <p className="text-left text-xs text-neutral-400">
        {PLANNER_COPY.marketplacePrompt}{" "}
        <Link href="/client/browse" className="text-primary underline-offset-2 hover:underline">
          {PLANNER_COPY.marketplaceLink}
        </Link>
      </p>
    </div>
  );
}
