import assert from "node:assert/strict";
import { test } from "node:test";
import { adminMemberRoleLabel } from "@/domains/admin-team/adminMemberRoleLabel";

test("adminMemberRoleLabel maps roles", () => {
  assert.equal(adminMemberRoleLabel("super_admin"), "Super admin");
  assert.equal(adminMemberRoleLabel("admin"), "Admin");
  assert.equal(adminMemberRoleLabel(null), "Admin");
});
