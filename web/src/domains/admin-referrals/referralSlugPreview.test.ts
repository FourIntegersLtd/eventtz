import assert from "node:assert/strict";
import { test } from "node:test";
import { referralSlugPreview } from "@/domains/admin-referrals/referralSlugPreview";

test("referralSlugPreview slugifies a display name", () => {
  assert.equal(referralSlugPreview("Jane's Events"), "janes-events");
  assert.equal(referralSlugPreview("   "), "creator");
});
