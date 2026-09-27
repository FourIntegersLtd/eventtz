import assert from "node:assert/strict";
import { test } from "node:test";
import { adminCapabilities, isSuperAdmin } from "@/capabilities/admin-shell/permissions";
import type { Session } from "@/foundation/session/types";

function sessionFor(userType: string, adminRole: string | null = null): Session {
  return {
    user: {
      id: "11111111-1111-1111-1111-111111111111",
      account_suspended: false,
      user_type: userType,
      admin_role: adminRole,
    },
  };
}

const superAdminSession = sessionFor("admin", "super_admin");
const plainAdminSession = sessionFor("admin", "admin");
const vendorSession = sessionFor("vendor");
const clientSession = sessionFor("client");

test("isSuperAdmin is true only for a super_admin admin", () => {
  assert.equal(isSuperAdmin(superAdminSession), true);
  assert.equal(isSuperAdmin(plainAdminSession), false);
  assert.equal(isSuperAdmin(vendorSession), false);
  assert.equal(isSuperAdmin(clientSession), false);
  assert.equal(isSuperAdmin(null), false);
});

test("adminCapabilities for a super admin", () => {
  assert.equal(adminCapabilities.canManageAdminTeam(superAdminSession), true);
  assert.equal(adminCapabilities.canRunBookingSupportActions(superAdminSession), true);
  assert.equal(adminCapabilities.canResolveDisputesFinancially(superAdminSession), true);
  assert.equal(adminCapabilities.canExportFinancials(superAdminSession), true);
  assert.equal(adminCapabilities.canBroadcastMessages(superAdminSession), true);
  assert.equal(adminCapabilities.canSendTestEmails(superAdminSession), true);
  assert.equal(adminCapabilities.canModerateReviews(superAdminSession), true);
});

test("adminCapabilities for a plain admin", () => {
  assert.equal(adminCapabilities.canManageAdminTeam(plainAdminSession), false);
  assert.equal(adminCapabilities.canRunBookingSupportActions(plainAdminSession), false);
  assert.equal(adminCapabilities.canResolveDisputesFinancially(plainAdminSession), false);
  assert.equal(adminCapabilities.canExportFinancials(plainAdminSession), false);
  assert.equal(adminCapabilities.canBroadcastMessages(plainAdminSession), false);
  assert.equal(adminCapabilities.canSendTestEmails(plainAdminSession), false);
  assert.equal(adminCapabilities.canModerateReviews(plainAdminSession), true);
});

test("adminCapabilities for a vendor", () => {
  assert.equal(adminCapabilities.canManageAdminTeam(vendorSession), false);
  assert.equal(adminCapabilities.canRunBookingSupportActions(vendorSession), false);
  assert.equal(adminCapabilities.canResolveDisputesFinancially(vendorSession), false);
  assert.equal(adminCapabilities.canExportFinancials(vendorSession), false);
  assert.equal(adminCapabilities.canBroadcastMessages(vendorSession), false);
  assert.equal(adminCapabilities.canSendTestEmails(vendorSession), false);
  assert.equal(adminCapabilities.canModerateReviews(vendorSession), false);
});

test("adminCapabilities for a client", () => {
  assert.equal(adminCapabilities.canManageAdminTeam(clientSession), false);
  assert.equal(adminCapabilities.canRunBookingSupportActions(clientSession), false);
  assert.equal(adminCapabilities.canResolveDisputesFinancially(clientSession), false);
  assert.equal(adminCapabilities.canExportFinancials(clientSession), false);
  assert.equal(adminCapabilities.canBroadcastMessages(clientSession), false);
  assert.equal(adminCapabilities.canSendTestEmails(clientSession), false);
  assert.equal(adminCapabilities.canModerateReviews(clientSession), false);
});
