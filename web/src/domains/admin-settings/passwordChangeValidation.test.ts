import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePasswordChange } from "@/domains/admin-settings/passwordChangeValidation";

test("validatePasswordChange rejects mismatched passwords", () => {
  assert.equal(
    validatePasswordChange("secret-one", "secret-two"),
    "The new password and confirmation don't match.",
  );
  assert.equal(validatePasswordChange("same", "same"), null);
});
