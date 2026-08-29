import { describe, expect, it } from "vitest";
import { isVendorPreApprovalRoute, vendorIsLiveApproved } from "@/lib/vendorAccess";

describe("vendorIsLiveApproved", () => {
  it("is true only for submitted + approved", () => {
    expect(vendorIsLiveApproved({ onboarding_status: "submitted", approval_status: "approved" })).toBe(
      true,
    );
  });

  it("is false while pending review", () => {
    expect(vendorIsLiveApproved({ onboarding_status: "submitted", approval_status: "pending" })).toBe(
      false,
    );
  });

  it("is false for draft profiles", () => {
    expect(vendorIsLiveApproved({ onboarding_status: "draft", approval_status: "approved" })).toBe(
      false,
    );
  });
});

describe("isVendorPreApprovalRoute", () => {
  it("allows profile, help hub, and settings", () => {
    expect(isVendorPreApprovalRoute("/vendor/profile")).toBe(true);
    expect(isVendorPreApprovalRoute("/vendor/profile/reviews")).toBe(true);
    expect(isVendorPreApprovalRoute("/vendor/help")).toBe(true);
    expect(isVendorPreApprovalRoute("/vendor/help/messages/abc")).toBe(true);
    expect(isVendorPreApprovalRoute("/vendor/settings")).toBe(true);
  });

  it("does not allow dashboard or bookings", () => {
    expect(isVendorPreApprovalRoute("/vendor/dashboard")).toBe(false);
    expect(isVendorPreApprovalRoute("/vendor/bookings")).toBe(false);
    expect(isVendorPreApprovalRoute("/vendor/payments")).toBe(false);
  });
});
