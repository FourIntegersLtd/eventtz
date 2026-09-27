"use client";

/**
 * Generate, load, and replace a celebration plan.
 *
 * A ref blocks a second generate or replace while one is in flight: a
 * disabled button alone still lets a double click through before React
 * re-renders. Listing plans is best-effort; a failure leaves the list empty
 * and does not surface an error, as in the baseline.
 */
import { useCallback, useRef, useState } from "react";
import { isPlatformError, platformErrorDetail } from "@/foundation/platform-client";
import {
  createCelebrationPlan,
  fetchCelebrationPlan,
  listClientPlans,
  replacePlanRecommendation,
  type PlanDetail,
  type PlanListItem,
} from "@/domains/client-planner/api";
import { generateFailureCopy, loadPlanFailureCopy, replaceFailureCopy } from "@/domains/client-planner/copySelection";
import { activePlans, planWithReplacedRecommendation } from "@/domains/client-planner/plannerModel";

/** The platform error code, or null for a transport failure (no code to branch on). */
function platformErrorCode(cause: unknown): string | null {
  return isPlatformError(cause) ? cause.code : null;
}

/** State and actions for `/client/planner` and `/client/planner/[planId]`. */
export function useGeneratePlan() {
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(0);
  const [replacingNeedId, setReplacingNeedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simpleIntent, setSimpleIntent] = useState(false);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [recentPlans, setRecentPlans] = useState<PlanListItem[]>([]);
  const generateLock = useRef(false);
  const replaceLock = useRef(false);

  const refreshList = useCallback(async () => {
    try {
      const plans = await listClientPlans();
      setRecentPlans(activePlans(plans));
    } catch {
      /* The list is secondary to the plan itself. */
    }
  }, []);

  const generate = useCallback(
    async (rawPrompt: string) => {
      const trimmed = rawPrompt.trim();
      if (!trimmed || generateLock.current) return;
      generateLock.current = true;
      setLoadingSession((session) => session + 1);
      setLoading(true);
      setError(null);
      setSimpleIntent(false);
      setPlan(null);
      try {
        const result = await createCelebrationPlan(trimmed);
        setPlan(result);
        await refreshList();
      } catch (cause: unknown) {
        const failure = generateFailureCopy(platformErrorCode(cause), platformErrorDetail(cause));
        setSimpleIntent(failure.simpleIntent);
        setError(failure.message);
        setPlan(null);
      } finally {
        generateLock.current = false;
        setLoading(false);
      }
    },
    [refreshList],
  );

  const loadPlan = useCallback(async (planId: string) => {
    setLoadingSession((session) => session + 1);
    setLoading(true);
    setError(null);
    setSimpleIntent(false);
    try {
      const result = await fetchCelebrationPlan(planId);
      setPlan(result);
    } catch (cause: unknown) {
      setError(loadPlanFailureCopy(platformErrorCode(cause), platformErrorDetail(cause)));
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const replaceNeed = useCallback(
    async (needId: string) => {
      if (!plan || replaceLock.current) return;
      replaceLock.current = true;
      setReplacingNeedId(needId);
      setError(null);
      try {
        const replaced = await replacePlanRecommendation(plan.plan_id, needId);
        const merged = planWithReplacedRecommendation(plan, replaced.recommendation);
        setPlan(merged);
        // Replace returns one need. Reload so the server's recomputed budget
        // and confidence replace the stale ones. A failed reload keeps the swap.
        try {
          const refreshed = await fetchCelebrationPlan(plan.plan_id);
          setPlan(refreshed);
        } catch {
          /* The recommendation already changed. */
        }
      } catch (cause: unknown) {
        setError(replaceFailureCopy(platformErrorCode(cause), platformErrorDetail(cause)));
      } finally {
        replaceLock.current = false;
        setReplacingNeedId(null);
      }
    },
    [plan],
  );

  return {
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
  };
}
