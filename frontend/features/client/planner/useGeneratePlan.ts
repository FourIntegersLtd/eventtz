"use client";

import { useCallback, useState } from "react";
import {
  createCelebrationPlan,
  fetchCelebrationPlan,
  listCelebrationPlans,
  replacePlanRecommendation,
  type CelebrationPlanListItem,
  type CelebrationPlanResponse,
} from "@/lib/clientPlannerApi";
import { getApiErrorCode, getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

export type GeneratePlanState = {
  loading: boolean;
  error: string | null;
  simpleIntent: boolean;
  plan: CelebrationPlanResponse | null;
  recentPlans: CelebrationPlanListItem[];
};

export function useGeneratePlan() {
  const [loading, setLoading] = useState(false);
  const [replacingNeedId, setReplacingNeedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simpleIntent, setSimpleIntent] = useState(false);
  const [plan, setPlan] = useState<CelebrationPlanResponse | null>(null);
  const [recentPlans, setRecentPlans] = useState<CelebrationPlanListItem[]>([]);

  const refreshList = useCallback(async () => {
    try {
      const plans = await listCelebrationPlans();
      setRecentPlans(plans.filter((p) => p.status === "active"));
    } catch {
      /* list is secondary */
    }
  }, []);

  const generate = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSimpleIntent(false);
    setPlan(null);
    try {
      const result = await createCelebrationPlan(trimmed);
      setPlan(result);
      track(MixpanelEvents.planner_plan_generated, {
        plan_id: result.plan_id,
        confidence: result.confidence.score,
        recommendation_count: result.recommendations.length,
        event_type: result.celebration.event_type ?? undefined,
      });
      await refreshList();
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "simple_intent") {
        setSimpleIntent(true);
        setError(getApiErrorDetail(err) || "Try Browse for a simple vendor search.");
        track(MixpanelEvents.planner_simple_intent_redirect);
      } else {
        setError(getApiErrorDetail(err) || "Could not build your plan right now.");
        track(MixpanelEvents.planner_generate_failed);
      }
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [refreshList]);

  const loadPlan = useCallback(async (planId: string) => {
    setLoading(true);
    setError(null);
    setSimpleIntent(false);
    try {
      const result = await fetchCelebrationPlan(planId);
      setPlan(result);
      track(MixpanelEvents.planner_plan_viewed, { plan_id: planId });
    } catch (err) {
      setError(getApiErrorDetail(err) || "Could not load this plan.");
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const replaceNeed = useCallback(
    async (needId: string) => {
      if (!plan) return;
      const current = plan.recommendations.find((r) => r.need_id === needId);
      const exclude = current?.primary?.user_id;
      setReplacingNeedId(needId);
      setError(null);
      try {
        const result = await replacePlanRecommendation(plan.plan_id, needId, exclude);
        setPlan(result);
        track(MixpanelEvents.planner_recommendation_replaced, {
          plan_id: plan.plan_id,
          need_id: needId,
        });
      } catch (err) {
        setError(getApiErrorDetail(err) || "Could not replace this recommendation.");
      } finally {
        setReplacingNeedId(null);
      }
    },
    [plan],
  );

  return {
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
    setPlan,
  };
}
