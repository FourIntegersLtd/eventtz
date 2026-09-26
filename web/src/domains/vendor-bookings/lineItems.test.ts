import assert from "node:assert/strict";
import { test } from "node:test";
import { toDisplayLineItem } from "@/domains/vendor-bookings/lineItems";

test("toDisplayLineItem reads a well-formed line item", () => {
  const result = toDisplayLineItem(
    { id: "li_1", heading: "DJ set", quantity: 2, unit_label: "hour", unit_price_gbp: 75 },
    0,
  );
  assert.deepEqual(result, { id: "li_1", heading: "DJ set", quantity: 2, unitLabel: "hour", unitPriceGbp: 75 });
});

test("toDisplayLineItem falls back to unit_rate_gbp when unit_price_gbp is absent", () => {
  const result = toDisplayLineItem({ id: "li_2", heading: "Catering", unit_rate_gbp: 12.5 }, 1);
  assert.equal(result.unitPriceGbp, 12.5);
});

test("toDisplayLineItem fills in safe defaults for a malformed entry", () => {
  const result = toDisplayLineItem({ heading: 42, quantity: "two" }, 3);
  assert.deepEqual(result, { id: "line-3", heading: "Item", quantity: null, unitLabel: null, unitPriceGbp: null });
});
