/**
 * Which sentence the planner shows for a failed generate, load, or replace.
 *
 * The API's `detail` wins when it sent one; the fallbacks are the baseline's
 * `useGeneratePlan` strings. `simple_intent` is not an error banner.
 */
import {
  NO_MORE_ALTERNATIVES,
  PLAN_ARCHIVED,
  PLAN_BUILD_FAILED,
  PLAN_LOAD_FAILED,
  PLAN_NOT_FOUND,
  REPLACE_FAILED,
  SIMPLE_INTENT,
} from "@/domains/client-planner/plannerCopy";

export interface GenerateFailureCopy {
  simpleIntent: boolean;
  message: string;
}

/** Copy for a failed `POST /client/planner/plans`, keyed by `PlatformError.code`. */
export function generateFailureCopy(code: string | null, detail: string | null): GenerateFailureCopy {
  if (code === "simple_intent") {
    return { simpleIntent: true, message: detail ?? SIMPLE_INTENT };
  }
  return { simpleIntent: false, message: detail ?? PLAN_BUILD_FAILED };
}

/** Copy for a failed `GET /client/planner/plans/{id}`. */
export function loadPlanFailureCopy(code: string | null, detail: string | null): string {
  if (code === "plan_not_found") return detail ?? PLAN_NOT_FOUND;
  if (code === "plan_archived") return detail ?? PLAN_ARCHIVED;
  return detail ?? PLAN_LOAD_FAILED;
}

/** Copy for a failed replace. `no_more_alternatives` keeps the baseline sentence. */
export function replaceFailureCopy(code: string | null, detail: string | null): string {
  if (code === "no_more_alternatives") return detail ?? NO_MORE_ALTERNATIVES;
  return detail ?? REPLACE_FAILED;
}
