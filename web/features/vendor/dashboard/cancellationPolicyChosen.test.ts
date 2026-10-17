import { describe, expect, it } from "vitest";

import { cancellationPolicyChosenFor } from "@/features/vendor/dashboard/useVendorDashboard";

const profile = (approval: string, form: Record<string, unknown>) => ({
  success: true,
  current_step: 7,
  onboarding_status: "submitted",
  approval_status: approval,
  profile_form_data: form,
});

describe("cancellationPolicyChosenFor", () => {
  it("nudges only an approved vendor whose form has no preset", () => {
    expect(cancellationPolicyChosenFor(profile("approved", {}))).toBe(false);
    expect(cancellationPolicyChosenFor(profile("approved", { cancellationPolicy: "strict" }))).toBe(true);
  });

  it("stays quiet for drafts, pending approval and an unloaded profile", () => {
    expect(cancellationPolicyChosenFor(profile("pending", {}))).toBeNull();
    expect(cancellationPolicyChosenFor(null)).toBeNull();
  });
});
