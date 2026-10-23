import { describe, expect, it } from "vitest";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { vendorIsBulkEmailSelectable } from "./adminVendorBulkEmail";

const row = (fields: Partial<AdminVendorRow>) => fields as AdminVendorRow;

describe("vendorIsBulkEmailSelectable", () => {
  it("allows an unfinished draft", () => {
    expect(vendorIsBulkEmailSelectable(row({ onboarding_status: "draft", approval_status: "pending" }))).toBe(true);
  });

  it("allows an approved vendor without payouts", () => {
    expect(
      vendorIsBulkEmailSelectable(
        row({ onboarding_status: "submitted", approval_status: "approved", payouts_verified: false }),
      ),
    ).toBe(true);
  });

  it("refuses a suspended vendor even when they are a draft", () => {
    expect(vendorIsBulkEmailSelectable(row({ onboarding_status: "draft", approval_status: "banned" }))).toBe(false);
  });
});
