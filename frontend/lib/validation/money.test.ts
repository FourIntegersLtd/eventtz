import { describe, expect, it } from "vitest";
import {
  packagePriceFieldSchema,
  parseSingleMoneyNumber,
  singleGbpAmountFieldError,
  validateSingleMoneyAmount,
} from "@/lib/validation/money";

describe("validateSingleMoneyAmount", () => {
  it("accepts a plain number or optional £ prefix", () => {
    expect(validateSingleMoneyAmount("150", "Package price", { required: true })).toBeNull();
    expect(validateSingleMoneyAmount("£150", "Package price", { required: true })).toBeNull();
    expect(validateSingleMoneyAmount("150.50", "Package price", { required: true })).toBeNull();
  });

  it("rejects comma-separated prices", () => {
    expect(validateSingleMoneyAmount("150, 180", "Package price", { required: true })).toMatch(
      /one amount only/i,
    );
    expect(validateSingleMoneyAmount("150,180", "Package price", { required: true })).toMatch(
      /one amount only/i,
    );
  });

  it("rejects semicolon and slash-separated prices", () => {
    expect(validateSingleMoneyAmount("150;180", "Package price", { required: true })).toMatch(
      /one amount only/i,
    );
    expect(validateSingleMoneyAmount("150/180", "Package price", { required: true })).toMatch(
      /one amount only/i,
    );
  });

  it("rejects starts-from and range wording", () => {
    expect(validateSingleMoneyAmount("starts from 150", "Package price", { required: true })).toMatch(
      /fixed amount/i,
    );
    expect(validateSingleMoneyAmount("150-180", "Package price", { required: true })).toMatch(
      /fixed amount/i,
    );
  });

  it("does not concatenate digits from invalid input", () => {
    expect(parseSingleMoneyNumber("150, 180")).toBeNull();
    expect(parseSingleMoneyNumber("150,180")).toBeNull();
    expect(parseSingleMoneyNumber("150;180")).toBeNull();
  });
});

describe("singleGbpAmountFieldSchema (Zod)", () => {
  it("parses valid amounts", () => {
    expect(packagePriceFieldSchema.safeParse("150").success).toBe(true);
    expect(packagePriceFieldSchema.safeParse("£150.50").success).toBe(true);
  });

  it("rejects multiple amounts via Zod", () => {
    const result = packagePriceFieldSchema.safeParse("150;180");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/one amount only/i);
    }
    expect(singleGbpAmountFieldError("150, 180", "Package price", { required: true })).toMatch(
      /one amount only/i,
    );
  });
});

describe("packageQuality completeness", () => {
  it("does not treat comma-separated prices as complete", async () => {
    const { isCompletePackage } = await import("@/features/vendor/onboarding/packageQuality");
    const longDetails =
      "Ten spring rolls, ten samosas, and five puff-puff with delivery included.";
    expect(
      isCompletePackage({
        title: "Small Chops Pack",
        price: "150,180",
        details: longDetails,
      }),
    ).toBe(false);
  });

  it("routes packageFieldErrors to the price field", async () => {
    const { packageFieldErrors } = await import("@/features/vendor/onboarding/packageQuality");
    const errors = packageFieldErrors(
      { title: "Pack", price: "150;180", details: "x".repeat(40) },
      { strict: true },
    );
    expect(errors.price).toMatch(/one amount only/i);
    expect(errors.all).toContain(errors.price);
  });
});
