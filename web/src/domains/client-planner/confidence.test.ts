/**
 * Confidence band thresholds from the baseline badge, and the visible label.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { confidenceBadgeClass, confidenceBand, confidenceLabel } from "@/domains/client-planner/confidence";

test("confidenceBand is high from 80, medium from 55, otherwise low", () => {
  assert.equal(confidenceBand(100), "high");
  assert.equal(confidenceBand(80), "high");
  assert.equal(confidenceBand(79), "medium");
  assert.equal(confidenceBand(55), "medium");
  assert.equal(confidenceBand(54), "low");
  assert.equal(confidenceBand(0), "low");
});

test("confidenceBadgeClass uses the baseline colour classes for each band", () => {
  assert.equal(confidenceBadgeClass(90), "border-emerald-200 bg-emerald-50 text-emerald-900");
  assert.equal(confidenceBadgeClass(60), "border-amber-200 bg-amber-50 text-amber-900");
  assert.equal(confidenceBadgeClass(10), "border-neutral-200 bg-neutral-50 text-neutral-800");
});

test("confidenceLabel is the baseline heading", () => {
  assert.equal(confidenceLabel(90), "Confidence 90%");
  assert.equal(confidenceLabel(0), "Confidence 0%");
});
