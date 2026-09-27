import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleAdminNavItems } from "@/capabilities/admin-shell/navVisibility";

test("a plain admin does not see Email health in the nav", () => {
  const labels = visibleAdminNavItems(false).map((item) => item.label);
  assert.equal(labels.includes("Email health"), false);
  assert.equal(labels.includes("Dashboard"), true);
});

test("a super admin sees Email health in the nav", () => {
  const labels = visibleAdminNavItems(true).map((item) => item.label);
  assert.equal(labels.includes("Email health"), true);
});
