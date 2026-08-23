import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingAcceptBookingId,
  getPendingAcceptBookingId,
  setPendingAcceptBookingId,
} from "@/features/vendor/payments/payoutAcceptIntent";
import { isVendorPayoutsReady } from "@/features/vendor/payments/useVendorPayoutsReady";

describe("useVendorPayoutAcceptResume prerequisites", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const sessionStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    vi.stubGlobal("window", { sessionStorage });
    vi.stubGlobal("sessionStorage", sessionStorage);
    clearPendingAcceptBookingId();
  });

  it("resumes accept only when payouts are ready and pending id matches", () => {
    const bookingId = "booking-abc";
    setPendingAcceptBookingId(bookingId);
    const ready = isVendorPayoutsReady({
      charges_enabled: true,
      payouts_enabled: true,
    } as never);
    expect(ready).toBe(true);
    expect(getPendingAcceptBookingId()).toBe(bookingId);
    clearPendingAcceptBookingId();
    expect(getPendingAcceptBookingId()).toBeNull();
  });

  it("blocks resume when payouts are not ready", () => {
    expect(
      isVendorPayoutsReady({ charges_enabled: true, payouts_enabled: false } as never),
    ).toBe(false);
  });
});
