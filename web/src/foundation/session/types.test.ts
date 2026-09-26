import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, isAdmin, type Session } from "@/foundation/session/types";

/** A minimal, valid `AuthUser` fixture — only the fields `can()`/`isAdmin()` read. */
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

describe("can()", () => {
  it("grants access_client_portal only to a client", () => {
    assert.equal(can(sessionFor("client"), "access_client_portal"), true);
    assert.equal(can(sessionFor("vendor"), "access_client_portal"), false);
    assert.equal(can(sessionFor("admin"), "access_client_portal"), false);
  });

  it("grants access_vendor_portal only to a vendor", () => {
    assert.equal(can(sessionFor("vendor"), "access_vendor_portal"), true);
    assert.equal(can(sessionFor("client"), "access_vendor_portal"), false);
  });

  it("grants access_admin_portal only to an admin", () => {
    assert.equal(can(sessionFor("admin"), "access_admin_portal"), true);
    assert.equal(can(sessionFor("client"), "access_admin_portal"), false);
  });

  it("grants manage_admin_team only to a super_admin, not any admin", () => {
    assert.equal(can(sessionFor("admin", "super_admin"), "manage_admin_team"), true);
    assert.equal(can(sessionFor("admin", "support"), "manage_admin_team"), false);
    assert.equal(can(sessionFor("admin", null), "manage_admin_team"), false);
    assert.equal(can(sessionFor("vendor", "super_admin"), "manage_admin_team"), false);
  });

  it("denies everything when there is no session", () => {
    assert.equal(can(null, "access_client_portal"), false);
    assert.equal(can(null, "access_admin_portal"), false);
    assert.equal(can(null, "manage_admin_team"), false);
  });

  it("denies everything for an unrecognised user_type", () => {
    assert.equal(can(sessionFor("staff"), "access_client_portal"), false);
    assert.equal(can(sessionFor("staff"), "access_admin_portal"), false);
  });
});

describe("isAdmin()", () => {
  it("is true only for an admin session", () => {
    assert.equal(isAdmin(sessionFor("admin")), true);
    assert.equal(isAdmin(sessionFor("client")), false);
    assert.equal(isAdmin(null), false);
  });
});
