import { describe, expect, it } from "vitest";
import { PACKAGE_EXAMPLES_BY_SERVICE } from "@/lib/vendorOnboarding/packageExamples";
import { SERVICES_REQUIRING_PACKAGES } from "@/lib/vendorOnboarding/packageQuality";
import { VENDOR_SERVICE_OPTIONS } from "@/lib/vendorServiceCatalog";
import { marketplaceStateFromSearchParams } from "@/lib/marketplaceSearchParams";

describe("vendorServiceCatalog", () => {
  it("lists ten onboardable service keys", () => {
    expect(VENDOR_SERVICE_OPTIONS).toHaveLength(10);
    expect(VENDOR_SERVICE_OPTIONS.map((option) => option.value).sort()).toEqual(
      [
        "baking",
        "catering",
        "decor",
        "dj",
        "event_planning",
        "hair_styling",
        "makeup",
        "mc",
        "photography",
        "rentals",
      ].sort(),
    );
  });

  it("gives every category a non-empty examples line for the pickers", () => {
    for (const { value, examples } of VENDOR_SERVICE_OPTIONS) {
      expect(examples, `missing examples for ${value}`).toMatch(/\w+, \w+/);
    }
    expect(VENDOR_SERVICE_OPTIONS.find((option) => option.value === "hair_styling")?.examples).toContain(
      "gele tying",
    );
  });

  it("has package examples for every onboardable service", () => {
    for (const { value } of VENDOR_SERVICE_OPTIONS) {
      expect(PACKAGE_EXAMPLES_BY_SERVICE[value], `missing examples for ${value}`).toBeDefined();
    }
  });

  it("does not require packages for DJ or MC", () => {
    expect(SERVICES_REQUIRING_PACKAGES.has("dj")).toBe(false);
    expect(SERVICES_REQUIRING_PACKAGES.has("mc")).toBe(false);
    expect(SERVICES_REQUIRING_PACKAGES.has("decor")).toBe(true);
    expect(SERVICES_REQUIRING_PACKAGES.has("hair_styling")).toBe(true);
  });
});

describe("marketplaceSearchParams", () => {
  it("drops unknown types from browse URLs", () => {
    const state = marketplaceStateFromSearchParams(
      new URLSearchParams("types=dj,not_a_real_type,decor"),
    );
    expect(state.types).toEqual(["dj", "decor"]);
  });

  it("keeps query and location as separate URL params", () => {
    const state = marketplaceStateFromSearchParams(
      new URLSearchParams("location=Leeds"),
    );
    expect(state.location).toBe("Leeds");
    expect(state.query).toBe("");
  });
});
