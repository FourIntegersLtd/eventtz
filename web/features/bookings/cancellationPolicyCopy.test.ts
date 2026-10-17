import { describe, expect, it } from "vitest";
import {
  CANCELLATION_POLICY_NOT_CHOSEN,
  cancellationPolicyLabel,
  describeCancellationPolicy,
  vendorCancellationPolicyLabel,
} from "@/features/bookings/cancellationPolicyCopy";

describe("cancellationPolicyCopy", () => {
  it("describes strict with four tiers plus the two shared lines", () => {
    const lines = describeCancellationPolicy("strict");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toBe("90 or more days before the event: full refund of the vendor's price");
    expect(lines[5]).toBe("The Eventtz service fee is always refunded");
  });

  it("falls back to flexible for unknown or empty presets", () => {
    expect(cancellationPolicyLabel("")).toBe("Flexible");
    expect(cancellationPolicyLabel("bogus")).toBe("Flexible");
    expect(describeCancellationPolicy("bogus")).toEqual(describeCancellationPolicy("flexible"));
  });

  it("labels moderate", () => {
    expect(cancellationPolicyLabel("moderate")).toBe("Moderate");
  });

  it("tells the vendor (not the client) when nothing is chosen yet", () => {
    expect(vendorCancellationPolicyLabel("")).toBe(CANCELLATION_POLICY_NOT_CHOSEN);
    expect(vendorCancellationPolicyLabel("strict")).toBe("Strict");
  });
});
