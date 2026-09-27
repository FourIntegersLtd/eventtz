import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVendorListParams } from "@/domains/admin-directory/vendorListParams";

test("buildVendorListParams omits blank filters", () => {
  assert.deepEqual(buildVendorListParams({ offset: 0, limit: 50, search: "", approvalStatus: "" }), {
    offset: 0,
    limit: 50,
  });
  assert.deepEqual(
    buildVendorListParams({ offset: 50, limit: 50, search: "cater", approvalStatus: "approved" }),
    { offset: 50, limit: 50, q: "cater", approval_status: "approved" },
  );
});
