import { describe, expect, it } from "vitest";
import {
  isCompletePackage,
  isConfiguredPackage,
  packageFieldErrors,
} from "./packageQuality";

describe("packageQuality per-unit", () => {
  const details = "White folding chairs, 3-day hire, delivery and collection within 10 miles.";

  it("treats missing pricing mode as a complete fixed package", () => {
    expect(
      isCompletePackage({
        title: "Gold package",
        price: "500",
        details,
      }),
    ).toBe(true);
  });

  it("requires a unit label for per-item packages", () => {
    expect(
      isCompletePackage({
        title: "Chair hire",
        price: "2",
        details,
        pricingMode: "per_unit",
        unitLabel: "",
      }),
    ).toBe(false);
    expect(
      isCompletePackage({
        title: "Chair hire",
        price: "2",
        details,
        pricingMode: "per_unit",
        unitLabel: "chair",
      }),
    ).toBe(true);
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
    expect(errors.minQuantity).toMatch(/cannot be greater/i);
  });

  it("treats per-item mode as configured even when other fields are empty", () => {
    expect(isConfiguredPackage({ pricingMode: "per_unit" })).toBe(true);
  });
});
