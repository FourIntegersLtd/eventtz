import { describe, expect, it, vi } from "vitest";
import {
  BOOKING_CONFIRM_COPY,
  VENDOR_BOOKING_ERROR_COPY,
  VENDOR_BOOKING_TOAST_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import { isVendorPayoutsReady } from "@/features/vendor/payments/useVendorPayoutsReady";
import { withMutationFeedback } from "@/lib/mutationFeedback";

describe("VENDOR_BOOKING_TOAST_COPY", () => {
  it("covers accept, decline, cancel, complete, and price-update toasts", () => {
    expect(VENDOR_BOOKING_TOAST_COPY.bookingAccepted).toMatch(/accepted/i);
    expect(VENDOR_BOOKING_TOAST_COPY.bookingDeclined).toMatch(/declined/i);
    expect(VENDOR_BOOKING_TOAST_COPY.bookingCancelled).toMatch(/cancelled/i);
    expect(VENDOR_BOOKING_TOAST_COPY.completionConfirmed).toMatch(/completion/i);
    expect(VENDOR_BOOKING_TOAST_COPY.updatedPriceSent).toMatch(/price/i);
  });

  it("warns that in-flight checkout will be cancelled or refunded", () => {
    expect(BOOKING_CONFIRM_COPY.cancelVendorPending.description).toMatch(/checkout|refund/i);
  });

  it("has fallback error copy for each vendor mutation", () => {
    expect(VENDOR_BOOKING_ERROR_COPY.acceptFailed).toMatch(/accept/i);
    expect(VENDOR_BOOKING_ERROR_COPY.cancelFailed).toMatch(/cancel/i);
    expect(VENDOR_BOOKING_ERROR_COPY.completionFailed).toMatch(/confirm/i);
  });
});

describe("isVendorPayoutsReady", () => {
  it("requires both charges and payouts to be enabled", () => {
    expect(isVendorPayoutsReady(null)).toBe(false);
    expect(
      isVendorPayoutsReady({ charges_enabled: true, payouts_enabled: false } as never),
    ).toBe(false);
    expect(
      isVendorPayoutsReady({ charges_enabled: true, payouts_enabled: true } as never),
    ).toBe(true);
  });
});

describe("withMutationFeedback", () => {
  it("toasts success and returns the result", async () => {
    const showToast = vi.fn();
    const result = await withMutationFeedback(showToast, {
      successTitle: VENDOR_BOOKING_TOAST_COPY.bookingAccepted,
      run: async () => "ok",
    });
    expect(result).toBe("ok");
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: VENDOR_BOOKING_TOAST_COPY.bookingAccepted, tone: "success" }),
    );
  });

  it("toasts errors and returns null", async () => {
    const showToast = vi.fn();
    const result = await withMutationFeedback(showToast, {
      successTitle: VENDOR_BOOKING_TOAST_COPY.bookingAccepted,
      run: async () => {
        throw new Error("nope");
      },
    });
    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" }));
  });
});
