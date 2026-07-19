"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { BudgetBreakdown } from "./BudgetBreakdown";
import { CelebrationSummary } from "./CelebrationSummary";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { PlannerNextSteps } from "./PlannerNextSteps";
import { PlannerPromptHero } from "./PlannerPromptHero";
import { RecommendationSection } from "./RecommendationSection";
import { PLANNER_COPY } from "./plannerCopy";
import { useGeneratePlan } from "./useGeneratePlan";

export function AiPlannerView({ initialPlanId }: { initialPlanId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q")?.trim() || "";
  const [prompt, setPrompt] = useState(qFromUrl);
  const [loadingTick, setLoadingTick] = useState(0);

  const {
    loading,
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
    track(MixpanelEvents.planner_opened);
    void refreshList();
    if (initialPlanId) {
      void loadPlan(initialPlanId);
    } else if (qFromUrl) {
      void generate(qFromUrl);
    }
  });

  useEffect(() => {
    onMount();
  }, [initialPlanId]);

  useEffect(() => {
    if (!loading) {
      setLoadingTick(0);
      return;
    }
    const id = window.setInterval(() => {
      setLoadingTick((n) => (n + 1) % PLANNER_COPY.loadingLabels.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [loading]);

  const handleSubmit = () => {
    void (async () => {
      await generate(prompt);
    })();
  };

  useEffect(() => {
    if (plan?.plan_id && plan.plan_id !== initialPlanId) {
      router.replace(`/client/planner/${plan.plan_id}`);
    }
  }, [plan?.plan_id, initialPlanId, router]);

  return (
    <div className="w-full max-w-5xl space-y-8">
      <PlannerPromptHero
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleSubmit}
        loading={loading && !plan}
      />

      {simpleIntent ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>{error || PLANNER_COPY.simpleIntentHint}</p>
          <ButtonLink
            href={`/client/browse?q=${encodeURIComponent(prompt.trim())}`}
            variant="secondary"
            size="sm"
            className="mt-3"
          >
            {PLANNER_COPY.browseCta}
          </ButtonLink>
        </div>
      ) : null}

      {error && !simpleIntent ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading && !plan ? (
        <LoadingState
          label={PLANNER_COPY.loadingLabels[loadingTick] ?? PLANNER_COPY.loadingLabels[0]}
          variant="centered"
          className="py-16"
        />
      ) : null}

      {plan ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-start">
            <CelebrationSummary plan={plan} />
            <ConfidenceBadge
              score={plan.confidence.score}
              reasons={plan.confidence.reasons}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
            <div className="space-y-5">
              <h3 className="font-heading text-xl font-semibold text-neutral-900">
                Recommended vendors
              </h3>
              {plan.recommendations.map((rec) => (
                <RecommendationSection
                  key={rec.need_id}
                  recommendation={rec}
                  replacing={replacingNeedId === rec.need_id}
                  onReplace={() => void replaceNeed(rec.need_id)}
                />
              ))}
            </div>
            <div className="space-y-5 lg:sticky lg:top-20">
              <BudgetBreakdown budget={plan.budget} />
              <PlannerNextSteps steps={plan.next_steps} />
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !plan && recentPlans.length ? (
        <section>
          <h3 className="font-heading text-lg font-semibold text-neutral-900">Your recent plans</h3>
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
                    <span className="text-xs text-neutral-500">
                      {[item.location, item.event_type?.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {item.confidence_score != null ? (
                    <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                      {item.confidence_score}%
                    </span>
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
        Prefer browsing?{" "}
        <Link href="/client/browse" className="text-primary underline-offset-2 hover:underline">
          Open the marketplace
        </Link>
      </p>
    </div>
  );
}
