/** packageQuality.test for the vendor onboarding wizard. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCompletePackage,
  isConfiguredPackage,
  packageFieldErrors,
} from "./packageQuality";

describe("packageQuality per-unit", () => {
  const details = "White folding chairs, 3-day hire, delivery and collection within 10 miles.";

  it("treats missing pricing mode as a complete fixed package", () => {
    assert.equal(
      isCompletePackage({
        title: "Gold package",
        price: "500",
        details,
      }),
      true);
  });

  it("requires a unit label for per-item packages", () => {
    assert.equal(
      isCompletePackage({
        title: "Chair hire",
        price: "2",
        details,
        pricingMode: "per_unit",
        unitLabel: "",
      }),
      false);
    assert.equal(
      isCompletePackage({
        title: "Chair hire",
        price: "2",
        details,
        pricingMode: "per_unit",
        unitLabel: "chair",
      }),
      true);
  });

  it("rejects min greater than max", () => {
    const errors = packageFieldErrors(
      {
        title: "Chair hire",
        price: "2",
        details,
        pricingMode: "per_unit",
        unitLabel: "chair",
        minQuantity: "20",
        maxQuantity: "10",
      },
      { strict: true },
    );
    assert.match(errors.minQuantity ?? "", /cannot be greater/i);
  });

  it("treats per-item mode as configured even when other fields are empty", () => {
    assert.equal(isConfiguredPackage({ pricingMode: "per_unit" }), true);
  });
});
