/**
 * Budget maths: integer pence totals, the bar scale, and the baseline's
 * whole-pound display rounding.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetBarMaxPence,
  budgetBarWidthPercent,
  budgetLinesTotalPence,
  gbpToPence,
  remainingBudgetCaption,
  remainingBudgetPence,
} from "@/domains/client-planner/budget";
import { formatGbp } from "@/domains/client-planner/format";

test("formatGbp matches the baseline whole-pound formatter", () => {
  assert.equal(formatGbp(null), "-");
  assert.equal(formatGbp(undefined), "-");
  assert.equal(formatGbp(Number.NaN), "-");
  assert.equal(formatGbp(0), "£0");
  assert.equal(formatGbp(500), "£500");
  assert.equal(formatGbp(1234), "£1,234");
  assert.equal(formatGbp(10000), "£10,000");
  assert.equal(formatGbp(10.4), "£10");
  assert.equal(formatGbp(10.5), "£11");
  assert.equal(formatGbp(29.7), "£30");
  assert.equal(formatGbp(-12.4), "-£12");
});

test("gbpToPence rounds half away from zero before any total", () => {
  assert.equal(gbpToPence(10.1), 1010);
  assert.equal(gbpToPence(10.2), 1020);
  assert.equal(gbpToPence(10.005), 1001);
  assert.equal(gbpToPence(0), 0);
});

test("budgetLinesTotalPence sums rounded lines, and remaining is user budget minus that", () => {
  assert.equal(budgetLinesTotalPence([10.1, 10.2, 500]), 2030 + 50000);
  assert.equal(budgetLinesTotalPence([]), 0);
  assert.equal(remainingBudgetPence(50, 2030), 2970);
  assert.equal(remainingBudgetPence(20, 2030), -30);
  assert.equal(remainingBudgetPence(null, 2030), null);
});

test("budget bar scale floors at £1 and widths stay within 100", () => {
  assert.equal(budgetBarMaxPence([500, 250], 1000), 100000);
  assert.equal(budgetBarWidthPercent(500, 100000), 50);
  assert.equal(budgetBarWidthPercent(250, 100000), 25);
  assert.equal(budgetBarMaxPence([0], null), 100);
  assert.equal(budgetBarWidthPercent(0, 100), 0);
  assert.equal(budgetBarWidthPercent(5000, 100000), 100);
});

test("remainingBudgetCaption uses the server remaining and whole pounds", () => {
  assert.equal(remainingBudgetCaption(2000, 10000), "£2,000 remaining");
  assert.equal(remainingBudgetCaption(0, 100), "£0 remaining");
  assert.equal(remainingBudgetCaption(-50.4, 100), "£50 over");
  assert.equal(remainingBudgetCaption(null, 100), "£0 over");
  assert.equal(remainingBudgetCaption(10, null), null);
});
