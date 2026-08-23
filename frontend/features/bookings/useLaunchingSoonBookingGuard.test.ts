import { describe, expect, it, vi } from "vitest";
import {
  isBookingBlockedByLaunchGuard,
  runLaunchingSoonGuard,
} from "@/features/bookings/useLaunchingSoonBookingGuard";

const mockState = vi.hoisted(() => ({
  launchingSoon: true,
  earlyAccessEmails: new Set<string>(),
}));

vi.mock("@/lib/bookingsLaunchingSoon", () => ({
  get BOOKINGS_LAUNCHING_SOON() {
    return mockState.launchingSoon;
  },
  hasBookingEarlyAccess: (email: string | null | undefined) =>
    Boolean(email && mockState.earlyAccessEmails.has(email.trim().toLowerCase())),
}));

describe("runLaunchingSoonGuard", () => {
  it("opens guard path and does not run the action when blocked", () => {
    const action = vi.fn();
    expect(runLaunchingSoonGuard(true, action)).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it("runs the action when not blocked", () => {
    const action = vi.fn();
    expect(runLaunchingSoonGuard(false, action)).toBe(false);
    expect(action).toHaveBeenCalledOnce();
  });
});

describe("isBookingBlockedByLaunchGuard", () => {
  it("blocks when launching soon and email has no early access", () => {
    mockState.launchingSoon = true;
    mockState.earlyAccessEmails.clear();
    expect(isBookingBlockedByLaunchGuard("guest@example.com")).toBe(true);
  });

  it("allows early-access emails while launching soon", () => {
    mockState.launchingSoon = true;
    mockState.earlyAccessEmails.add("y.hkehinde@yahoo.com");
    expect(isBookingBlockedByLaunchGuard("y.hkehinde@yahoo.com")).toBe(false);
  });

  it("allows everyone when the launching-soon flag is off", () => {
    mockState.launchingSoon = false;
    mockState.earlyAccessEmails.clear();
    expect(isBookingBlockedByLaunchGuard("guest@example.com")).toBe(false);
  });
});
