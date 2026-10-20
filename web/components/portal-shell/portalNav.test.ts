import { describe, expect, it } from "vitest";
import {
  clientBookingPortalTopbarTitle,
  portalNavItems,
  portalPageTitle,
} from "./portalNav";

describe("portalNavItems", () => {
  it("returns the full vendor nav when live approved", () => {
    expect(portalNavItems("vendor").map((item) => item.href)).toContain("/vendor/dashboard");
    expect(portalNavItems("vendor").map((item) => item.href)).toContain("/vendor/bookings");
  });

  it("keeps Profile and Settings while pending", () => {
    expect(portalNavItems("vendor", { vendorPreApproval: true }).map((item) => item.href)).toEqual([
      "/vendor/profile",
      "/vendor/settings",
    ]);
  });

  it("orders client nav to match design C10", () => {
    expect(portalNavItems("client").map((item) => item.label)).toEqual([
      "Dashboard",
      "Plan my event",
      "Browse vendors",
      "Favourites",
      "My bookings",
      "Disputes",
      "Help",
      "Settings",
    ]);
  });
});

describe("portalPageTitle (client)", () => {
  it("uses help and disputes on disputes routes", () => {
    expect(portalPageTitle("/client/disputes/abc", "client")).toBe("Help and disputes");
  });

  it("uses my bookings for payments hub", () => {
    expect(portalPageTitle("/client/payments", "client")).toBe("My bookings");
  });

  it("overrides pay and receipt routes", () => {
    expect(clientBookingPortalTopbarTitle("/client/bookings/id/pay")).toBe("Pay");
    expect(clientBookingPortalTopbarTitle("/client/bookings/id/receipt")).toBe("Receipt");
    expect(portalPageTitle("/client/bookings/id/pay", "client")).toBe("Pay");
  });

  it("uses review topbar when rate query is present", () => {
    expect(portalPageTitle("/client/bookings/id", "client", "rate=5")).toBe("Review");
  });
});
