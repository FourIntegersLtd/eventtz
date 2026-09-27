import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  payoutConnectButtonLabel,
  payoutRowStatusLabel,
  payoutSetupHeadline,
  payoutSetupStage,
} from "@/domains/vendor-payments/format";
import type { VendorPaymentsStatus } from "@/domains/vendor-payments/api";

function status(overrides: Partial<VendorPaymentsStatus> = {}): VendorPaymentsStatus {
  return {
    success: true,
    stripe_account_id: null,
    charges_enabled: false,
    payouts_enabled: false,
    can_accept_bookings: false,
    payout_gate_waived: false,
    ...overrides,
  };
}

describe("payoutSetupStage", () => {
  it("is not_started with no Stripe account and no status at all", () => {
    assert.equal(payoutSetupStage(null), "not_started");
    assert.equal(payoutSetupStage(status()), "not_started");
  });

  it("is in_progress once an account exists but is not fully enabled", () => {
    assert.equal(payoutSetupStage(status({ stripe_account_id: "acct_1", charges_enabled: true })), "in_progress");
  });

  it("is ready once both charges and payouts are enabled", () => {
    assert.equal(
      payoutSetupStage(status({ stripe_account_id: "acct_1", charges_enabled: true, payouts_enabled: true })),
      "ready",
    );
  });
});

describe("payoutSetupHeadline", () => {
  it("returns the literal copy for each stage", () => {
    assert.equal(payoutSetupHeadline("not_started"), "Connect your payout account");
    assert.equal(payoutSetupHeadline("in_progress"), "Almost there — finish verification");
    assert.equal(payoutSetupHeadline("ready"), "You're ready to get paid");
  });
});

describe("payoutConnectButtonLabel", () => {
  it("shows a busy label while connecting, regardless of stage", () => {
    assert.equal(payoutConnectButtonLabel("not_started", true), "Opening Stripe…");
    assert.equal(payoutConnectButtonLabel("ready", true), "Opening Stripe…");
  });

  it("shows the stage-specific label once idle", () => {
    assert.equal(payoutConnectButtonLabel("not_started", false), "Set up payouts");
    assert.equal(payoutConnectButtonLabel("in_progress", false), "Continue setup");
    assert.equal(payoutConnectButtonLabel("ready", false), "Manage on Stripe");
  });
});

describe("payoutRowStatusLabel", () => {
  it("maps known statuses to their display label", () => {
    assert.equal(payoutRowStatusLabel("paid"), "Paid out");
    assert.equal(payoutRowStatusLabel("awaiting"), "Awaiting payout");
  });

  it("title-cases an unrecognised status rather than hiding it", () => {
    assert.equal(payoutRowStatusLabel("reversed"), "Reversed");
  });
});
