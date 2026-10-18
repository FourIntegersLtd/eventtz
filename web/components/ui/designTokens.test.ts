import { describe, expect, it } from "vitest";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import { TONE } from "@/components/ui/tokens";
import { getInitials } from "@/components/ui/Avatar";
import { getBookingStatusMeta } from "@/lib/domain-types";
import { paymentStatusTone } from "@/lib/bookingStatusStyles";

describe("getButtonClassName", () => {
  it("styles the primary variant at the default size", () => {
    const classes = getButtonClassName();
    expect(classes).toContain("bg-primary text-white");
    expect(classes).toContain("font-medium");
    expect(classes).toContain("min-h-11 px-4 py-2 text-sm");
  });

  it("styles secondary as white with a strong line", () => {
    expect(getButtonClassName({ variant: "secondary" })).toContain(
      "border border-line-strong bg-white text-ink hover:bg-surface-3",
    );
  });

  it("styles destructive as a soft danger button", () => {
    expect(getButtonClassName({ variant: "destructive" })).toContain(
      "border border-danger-line bg-danger-soft text-danger",
    );
  });

  it("styles ghost with a surface-3 hover and adds the lg size", () => {
    expect(getButtonClassName({ variant: "ghost" })).toContain("hover:bg-surface-3");
    expect(getButtonClassName({ size: "lg" })).toContain("min-h-12 px-6 py-3 text-base");
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
