import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseRecipientUserIds,
  validateComposeMessage,
} from "@/domains/admin-messages/composeMessageValidation";

test("parseRecipientUserIds splits comma-separated ids", () => {
  assert.deepEqual(parseRecipientUserIds(" a, b ,,c "), ["a", "b", "c"]);
});

test("validateComposeMessage requires recipients for selected mode", () => {
  assert.equal(validateComposeMessage({ body: "Hello", audience: "selected", recipientUserIds: [] }), "Enter at least one recipient user ID.");
  assert.equal(
    validateComposeMessage({ body: "Hello", audience: "selected", recipientUserIds: ["id-1"] }),
    null,
  );
});
