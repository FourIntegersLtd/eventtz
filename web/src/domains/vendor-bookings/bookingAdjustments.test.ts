import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAdjustmentsPayload, emptyAdjustmentRow } from "@/domains/vendor-bookings/bookingAdjustments";

test("emptyAdjustmentRow starts blank with the requested kind and an 'other' tag", () => {
  assert.deepEqual(emptyAdjustmentRow("cost"), { kind: "cost", label: "", amount: "", tag: "other" });
  assert.deepEqual(emptyAdjustmentRow("discount"), { kind: "discount", label: "", amount: "", tag: "other" });
});

test("buildAdjustmentsPayload rejects an empty row set", () => {
  const result = buildAdjustmentsPayload([]);
  assert.deepEqual(result, { ok: false, error: "Add a charge or discount first." });
});

test("buildAdjustmentsPayload turns a cost row into a positive amount_gbp", () => {
  const result = buildAdjustmentsPayload([{ kind: "cost", label: "Extra hour", amount: "75", tag: "time" }]);
  assert.deepEqual(result, {
    ok: true,
    adjustments: [{ tag: "time", label: "Extra hour", amount_gbp: 75 }],
  });
});

test("buildAdjustmentsPayload turns a discount row into a negative amount_gbp", () => {
  const result = buildAdjustmentsPayload([{ kind: "discount", label: "Loyalty", amount: "20", tag: "other" }]);
  assert.deepEqual(result, {
    ok: true,
    adjustments: [{ tag: "other", label: "Loyalty", amount_gbp: -20 }],
  });
});

test("buildAdjustmentsPayload rejects a non-positive amount", () => {
  assert.deepEqual(buildAdjustmentsPayload([{ kind: "cost", label: "x", amount: "0", tag: "other" }]), {
    ok: false,
    error: "Each line needs a valid positive amount.",
  });
  assert.deepEqual(buildAdjustmentsPayload([{ kind: "cost", label: "x", amount: "not-a-number", tag: "other" }]), {
    ok: false,
    error: "Each line needs a valid positive amount.",
  });
});

test("buildAdjustmentsPayload requires a label on an extra cost but not a discount", () => {
  assert.deepEqual(buildAdjustmentsPayload([{ kind: "cost", label: "  ", amount: "10", tag: "other" }]), {
    ok: false,
    error: "Say what each extra charge is for.",
  });
  const discountResult = buildAdjustmentsPayload([{ kind: "discount", label: "  ", amount: "10", tag: "other" }]);
  assert.deepEqual(discountResult, {
    ok: true,
    adjustments: [{ tag: "other", label: "Discount", amount_gbp: -10 }],
  });
});

test("buildAdjustmentsPayload falls back to 'other' for a blank tag", () => {
  const result = buildAdjustmentsPayload([{ kind: "cost", label: "Setup", amount: "5", tag: "  " }]);
  assert.deepEqual(result, { ok: true, adjustments: [{ tag: "other", label: "Setup", amount_gbp: 5 }] });
});
