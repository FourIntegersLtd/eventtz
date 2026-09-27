/**
 * Error-code copy. `simple_intent` is a browse hint; every other generate
 * failure uses the API detail or `PLAN_BUILD_FAILED`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateFailureCopy, loadPlanFailureCopy, replaceFailureCopy } from "@/domains/client-planner/copySelection";
import {
  NO_MORE_ALTERNATIVES,
  PLAN_ARCHIVED,
  PLAN_BUILD_FAILED,
  PLAN_LOAD_FAILED,
  PLAN_NOT_FOUND,
  REPLACE_FAILED,
  SIMPLE_INTENT,
} from "@/domains/client-planner/plannerCopy";

test("generateFailureCopy treats simple_intent as a hint, not a banner", () => {
  assert.deepEqual(generateFailureCopy("simple_intent", null), {
    simpleIntent: true,
    message: SIMPLE_INTENT,
  });
  assert.deepEqual(generateFailureCopy("simple_intent", "Try browse for a DJ."), {
    simpleIntent: true,
    message: "Try browse for a DJ.",
  });
});

test("generateFailureCopy falls back to PLAN_BUILD_FAILED for every other code", () => {
  assert.deepEqual(generateFailureCopy("describe_celebration", null), {
    simpleIntent: false,
    message: PLAN_BUILD_FAILED,
  });
  assert.deepEqual(generateFailureCopy("invalid_prompt", "Describe your celebration in a few words - for example a birthday in London for 80 guests."), {
    simpleIntent: false,
    message: "Describe your celebration in a few words - for example a birthday in London for 80 guests.",
  });
  assert.deepEqual(generateFailureCopy(null, null), {
    simpleIntent: false,
    message: PLAN_BUILD_FAILED,
  });
});

test("loadPlanFailureCopy uses the not-found and archived sentences", () => {
  assert.equal(loadPlanFailureCopy("plan_not_found", null), PLAN_NOT_FOUND);
  assert.equal(loadPlanFailureCopy("plan_not_found", "Plan not found."), "Plan not found.");
  assert.equal(loadPlanFailureCopy("plan_archived", null), PLAN_ARCHIVED);
  assert.equal(loadPlanFailureCopy("plan_archived", "That plan is archived."), "That plan is archived.");
  assert.equal(loadPlanFailureCopy(null, null), PLAN_LOAD_FAILED);
});

test("replaceFailureCopy uses the no-more-alternatives sentence", () => {
  assert.equal(replaceFailureCopy("no_more_alternatives", null), NO_MORE_ALTERNATIVES);
  assert.equal(replaceFailureCopy("no_more_alternatives", "No more alternatives for this category."), NO_MORE_ALTERNATIVES);
  assert.equal(replaceFailureCopy("plan_item_not_found", "That plan item was not found."), "That plan item was not found.");
  assert.equal(replaceFailureCopy(null, null), REPLACE_FAILED);
});
