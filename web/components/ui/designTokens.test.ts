import { describe, expect, it } from "vitest";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import { CARD_SURFACE, TONE, formControlClass } from "@/components/ui/tokens";
import { getInitials } from "@/components/ui/Avatar";
import { getBookingStatusMeta } from "@/lib/domain-types";
import { paymentStatusTone } from "@/lib/bookingStatusStyles";

describe("getButtonClassName", () => {
  it("styles the primary variant at the default size with the canvas classes", () => {
    const classes = getButtonClassName();
    expect(classes.split(" ").slice(0, 2)).toEqual(["ez-btn", "ez-btn--primary"]);
    expect(classes).not.toContain("ez-btn--sm");
    expect(classes).not.toContain("ez-btn--lg");
  });

  it("maps secondary and its outline alias to ez-btn--secondary", () => {
    expect(getButtonClassName({ variant: "secondary" })).toContain("ez-btn ez-btn--secondary");
    expect(getButtonClassName({ variant: "outline" })).toContain("ez-btn ez-btn--secondary");
  });

  it("styles destructive as the quiet danger button on the danger tint", () => {
    expect(getButtonClassName({ variant: "destructive" })).toContain("ez-btn--danger-quiet bg-danger-soft");
  });

  it("maps ghost, inverted, sizes and the pill shape", () => {
    expect(getButtonClassName({ variant: "ghost" })).toContain("ez-btn--ghost");
    expect(getButtonClassName({ variant: "inverted" })).toContain("ez-btn--inverse");
    expect(getButtonClassName({ variant: "invertedOutline" })).toContain("ez-btn--inverse-outline");
    expect(getButtonClassName({ size: "lg" })).toContain("ez-btn--lg");
    expect(getButtonClassName({ size: "sm", shape: "pill" })).toContain("ez-btn--sm");
    expect(getButtonClassName({ shape: "pill" })).toContain("ez-btn--pill");
  });
});

describe("canvas surface tokens", () => {
  it("emits ez classes for cards and form controls", () => {
    expect(CARD_SURFACE).toBe("ez-card shadow-xs");
    expect(formControlClass("mt-1")).toBe("ez-input py-2.5 mt-1");
  });
});

describe("TONE", () => {
  it("maps every tone to literal text, background and line classes", () => {
    expect(TONE.success).toEqual({
      text: "text-success",
      background: "bg-success-soft",
      line: "border-success-line",
    });
    expect(TONE.danger.background).toBe("bg-danger-soft");
    expect(TONE.neutral.background).toBe("bg-surface-3");
    expect(Object.keys(TONE)).toEqual(["neutral", "brand", "success", "warning", "danger", "info"]);
  });
});

describe("status to tone mapping", () => {
  it("maps booking statuses", () => {
    expect(getBookingStatusMeta("pending").tone).toBe("warning");
    expect(getBookingStatusMeta("accepted").tone).toBe("success");
    expect(getBookingStatusMeta("completed").tone).toBe("info");
    expect(getBookingStatusMeta("cancelled").tone).toBe("neutral");
    expect(getBookingStatusMeta("disputed").tone).toBe("danger");
    expect(getBookingStatusMeta("not-a-status").tone).toBe("warning");
  });

  it("maps payment statuses", () => {
    expect(paymentStatusTone("paid")).toBe("success");
    expect(paymentStatusTone("payout_released")).toBe("info");
    expect(paymentStatusTone("partially_refunded")).toBe("danger");
    expect(paymentStatusTone("unpaid")).toBe("neutral");
  });
});

describe("getInitials", () => {
  it("uses first and last initials", () => {
    expect(getInitials("Amaka Obi")).toBe("AO");
    expect(getInitials("  zed ")).toBe("Z");
    expect(getInitials("")).toBe("?");
  });
});
