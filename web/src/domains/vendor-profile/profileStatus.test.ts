import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { profileStatusBanner, vendorIsLiveApproved } from "@/domains/vendor-profile/profileStatus";

describe("vendorIsLiveApproved", () => {
  it("is true only when submitted and approved", () => {
    assert.equal(vendorIsLiveApproved({ onboarding_status: "submitted", approval_status: "approved" }), true);
    assert.equal(vendorIsLiveApproved({ onboarding_status: "draft", approval_status: "approved" }), false);
    assert.equal(vendorIsLiveApproved({ onboarding_status: "submitted", approval_status: "pending" }), false);
  });
});

describe("profileStatusBanner", () => {
  it("warns when banned, regardless of other fields", () => {
    const banner = profileStatusBanner({
      onboarding_status: "submitted",
      approval_status: "banned",
      listing_visible: false,
      payouts_verified: false,
    });
    assert.equal(banner.tone, "warning");
    assert.match(banner.message, /restricted/);
  });

  it("prompts to submit while still drafting", () => {
    const banner = profileStatusBanner({
      onboarding_status: "draft",
      approval_status: "pending",
      listing_visible: false,
      payouts_verified: false,
    });
    assert.equal(banner.tone, "info");
    assert.match(banner.message, /submit it for review/);
  });

  it("shows the pending-review message once submitted", () => {
    const banner = profileStatusBanner({
      onboarding_status: "submitted",
      approval_status: "pending",
      listing_visible: false,
      payouts_verified: false,
    });
    assert.equal(banner.tone, "info");
    assert.match(banner.message, /reviewing your profile/);
  });

  it("warns that payouts are needed once approved but not visible", () => {
    const banner = profileStatusBanner({
      onboarding_status: "submitted",
      approval_status: "approved",
      listing_visible: false,
      payouts_verified: false,
    });
    assert.equal(banner.tone, "warning");
    assert.match(banner.message, /payouts/);
  });

  it("celebrates once approved and visible", () => {
    const banner = profileStatusBanner({
      onboarding_status: "submitted",
      approval_status: "approved",
      listing_visible: true,
      payouts_verified: true,
    });
    assert.equal(banner.tone, "success");
    assert.match(banner.message, /live/);
  });
});
