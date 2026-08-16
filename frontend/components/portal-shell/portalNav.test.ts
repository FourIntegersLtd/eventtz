import { describe, expect, it } from "vitest";
import { portalNavItems } from "./portalNav";

describe("portalNavItems", () => {
  it("returns the full vendor nav when live approved", () => {
    expect(portalNavItems("vendor").map((item) => item.href)).toContain("/vendor/dashboard");
    expect(portalNavItems("vendor").map((item) => item.href)).toContain("/vendor/bookings");
  });

  it("keeps Profile, Messages, Contact, and Settings while pending", () => {
    expect(portalNavItems("vendor", { vendorPreApproval: true }).map((item) => item.href)).toEqual([
      "/vendor/messages",
      "/vendor/profile",
      "/vendor/contact",
      "/vendor/settings",
    ]);
  });
});
