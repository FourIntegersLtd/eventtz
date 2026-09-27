import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEmailTestSend } from "@/domains/admin-email/emailTestValidation";

test("validateEmailTestSend requires template, email and body", () => {
  assert.equal(validateEmailTestSend({ templateId: "", toEmail: "a@b.com", messageBody: "Hi" }), "Choose a layout.");
  assert.equal(validateEmailTestSend({ templateId: "welcome", toEmail: "", messageBody: "Hi" }), "Enter a valid email address.");
  assert.equal(validateEmailTestSend({ templateId: "welcome", toEmail: "a@b.com", messageBody: " " }), "Enter a message.");
  assert.equal(validateEmailTestSend({ templateId: "welcome", toEmail: "a@b.com", messageBody: "Hi" }), null);
});
