import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateMarketplaceBudget } from "./marketplaceBudgetValidation";

describe("validateMarketplaceBudget", () => {
  it("rejects invalid min amounts", () => {
    const result = validateMarketplaceBudget({ min: "abc", max: "" });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.formError, "Enter a valid budget amount.");
    }
  });

  it("rejects max below min", () => {
    const result = validateMarketplaceBudget({ min: "500", max: "100" });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.formError, "Max budget must be at least the min.");
    }
  });

  it("accepts empty fields as null budgets", () => {
    const result = validateMarketplaceBudget({ min: "", max: "" });
    assert.deepStrictEqual(result, { ok: true, budgetMin: null, budgetMax: null });
  });
});
