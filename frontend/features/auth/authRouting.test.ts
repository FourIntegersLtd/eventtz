import { describe, expect, it } from "vitest";
import {
  dashboardPathForUserType,
  isNextPathAllowedForUserType,
  resolvePostAuthPath,
} from "@/features/auth/authRouting";

describe("authRouting", () => {
  it("routes each user type to the correct dashboard", () => {
    expect(dashboardPathForUserType("client")).toBe("/client/dashboard");
    expect(dashboardPathForUserType("vendor")).toBe("/vendor/dashboard");
    expect(dashboardPathForUserType("admin")).toBe("/admin/dashboard");
  });

  it("blocks stale vendor next paths for promoted admins", () => {
    expect(isNextPathAllowedForUserType("/vendor/dashboard", "admin")).toBe(false);
    expect(resolvePostAuthPath("/vendor/dashboard", "admin")).toBe("/admin/dashboard");
  });

  it("honors safe client next paths", () => {
    expect(isNextPathAllowedForUserType("/client/bookings/abc", "client")).toBe(true);
    expect(resolvePostAuthPath("/client/bookings/abc", "client")).toBe("/client/bookings/abc");
  });
});
