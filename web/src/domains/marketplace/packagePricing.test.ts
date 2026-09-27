import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultMinQuantity,
  isPerUnitPricing,
  lineTotalGbp,
  packageQuantityInputInvalid,
  parsePackagePricingMode,
  parsePackageQuantity,
  perUnitPriceSuffix,
} from "./packagePricing";

describe("packagePricing", () => {
  it("treats per_unit as per-unit and everything else as fixed", () => {
    assert.equal(parsePackagePricingMode("per_unit"), "per_unit");
    assert.equal(parsePackagePricingMode(" PER_UNIT "), "per_unit");
    assert.equal(parsePackagePricingMode("fixed"), "fixed");
    assert.equal(parsePackagePricingMode(null), "fixed");
    assert.equal(isPerUnitPricing("per_unit"), true);
    assert.equal(isPerUnitPricing("fixed"), false);
  });

  it("parses an in-range integer quantity and rejects the rest", () => {
    assert.equal(parsePackageQuantity("10"), 10);
    assert.equal(parsePackageQuantity(3), 3);
    assert.equal(parsePackageQuantity(""), null);
    assert.equal(parsePackageQuantity("10.5"), null);
    assert.equal(parsePackageQuantity(0), null);
    assert.equal(packageQuantityInputInvalid(""), false);
    assert.equal(packageQuantityInputInvalid("nope"), true);
    assert.equal(defaultMinQuantity("4"), 4);
    assert.equal(defaultMinQuantity(""), 1);
  });

  it("builds a unit suffix and a pence-rounded line total", () => {
    assert.equal(perUnitPriceSuffix("chair"), "/ chair");
    assert.equal(perUnitPriceSuffix("  "), "each");
    assert.equal(lineTotalGbp(2, 50), 100);
    assert.equal(lineTotalGbp(null, 2), null);
  });
});
