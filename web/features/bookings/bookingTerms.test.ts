import { describe, expect, it } from "vitest";
import {
  canConfirmDelivery,
  canReportDeposit,
  damageDepositError,
  deliverySplitErrors,
  depositAwardError,
  depositClaimError,
  depositFromPayload,
  depositState,
  depositSummaryLine,
  paymentDeadlineLine,
  serviceFeeBadgeLabel,
} from "@/features/bookings/bookingTerms";

describe("bookingTerms", () => {
  it("shows the service fee badge from the fee constant", () => {
    expect(serviceFeeBadgeLabel()).toBe("+5% service fee");
  });

  it("shows payment deadline only while unpaid", () => {
    expect(paymentDeadlineLine("client", "2026-11-01T10:00:00Z", "paid")).toBeNull();
    expect(paymentDeadlineLine("client", null, "unpaid")).toBeNull();
    expect(paymentDeadlineLine("client", "2026-11-01T10:00:00Z", "unpaid")).toMatch(
      /^Pay by .*, or this booking is cancelled and the date released\.$/,
    );
    expect(paymentDeadlineLine("vendor", "2026-11-01T10:00:00Z", "unpaid")).toMatch(
      /^Client must pay by /,
    );
  });

  it("offers delivery confirmation only while waiting", () => {
    expect(canConfirmDelivery({ payout_stage: "waiting_delivery" })).toBe(true);
    expect(canConfirmDelivery({ payout_stage: "final" })).toBe(false);
  });

  it("describes the deposit using the policy window", () => {
    expect(depositSummaryLine(150)).toBe(
      "Refundable deposit £150 – returned within 7 days after the event unless the vendor reports damage.",
    );
    expect(depositSummaryLine(null)).toBeNull();
  });

  it("derives deposit state and claim eligibility", () => {
    const held = { damage_deposit_gbp: 100, deposit_refund_due_at: "2030-01-01T00:00:00Z" };
    expect(depositState(held)).toBe("held");
    expect(canReportDeposit(held, new Date("2029-12-31T00:00:00Z"))).toBe(true);
    expect(canReportDeposit(held, new Date("2030-01-02T00:00:00Z"))).toBe(false);
    expect(depositState({ ...held, deposit_claimed_at: "x" })).toBe("claim_pending");
    expect(depositState({ ...held, deposit_claimed_at: "x", deposit_claim_resolved_at: "y" })).toBe("decided");
    expect(depositState({ ...held, deposit_refunded_at: "x" })).toBe("refunded");
    expect(depositState({})).toBe("none");
  });

  it("validates a deposit claim", () => {
    expect(depositClaimError("", "long enough note", 100)).toBe("Enter the amount you are claiming.");
    expect(depositClaimError("150", "long enough note", 100)).toBe("You can claim at most the £100 deposit.");
    expect(depositClaimError("50", "short", 100)).toMatch(/at least 10 characters/);
    expect(depositClaimError("50", "a chair was broken", 100)).toBeNull();
  });

  it("validates the admin award", () => {
    expect(depositAwardError("0", 80)).toBeNull();
    expect(depositAwardError("81", 80)).toBe("Enter an amount from £0 to £80.");
  });

  it("validates vendor split and deposit fields against policy", () => {
    expect(deliverySplitErrors("", "")).toEqual({ upfront: null, deadline: null });
    expect(deliverySplitErrors("60", "14")).toEqual({ upfront: null, deadline: null });
    expect(deliverySplitErrors("40", "14").upfront).toBe("Paid up front (%) must be a whole number from 50 to 80.");
    expect(deliverySplitErrors("60", "").deadline).toMatch(/both/);
    expect(deliverySplitErrors("60", "61").deadline).toBe("Days to deliver must be a whole number from 1 to 60.");
    expect(damageDepositError("1000")).toBeNull();
    expect(damageDepositError("1001")).toBe("Damage deposit must be an amount from £0 to £1,000.");
  });

  it("reads the deposit from the profile payload", () => {
    expect(depositFromPayload({ damageDepositGbp: "120" })).toBe(120);
    expect(depositFromPayload({ damageDepositGbp: "" })).toBeNull();
    expect(depositFromPayload(undefined)).toBeNull();
  });
});
