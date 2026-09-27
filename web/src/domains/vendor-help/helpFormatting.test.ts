import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSupportMessageTime, slugToLabel } from "@/domains/vendor-help/helpFormatting";

describe("slugToLabel", () => {
  it("strips the vendor audience prefix and swaps dashes for spaces", () => {
    assert.equal(slugToLabel("vendor-payouts-explained"), "payouts explained");
  });

  it("strips the client audience prefix too", () => {
    assert.equal(slugToLabel("client-refund-policy"), "refund policy");
  });

  it("leaves a slug with no audience prefix as-is but dash-free", () => {
    assert.equal(slugToLabel("getting-started"), "getting started");
  });
});

describe("formatSupportMessageTime", () => {
  it("formats a 24-hour clock time", () => {
    assert.equal(formatSupportMessageTime("2026-09-26T09:05:00.000Z"), "09:05");
  });

  it("returns an empty string for a missing timestamp", () => {
    assert.equal(formatSupportMessageTime(undefined), "");
  });
});
