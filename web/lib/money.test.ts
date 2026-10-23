import { describe, expect, it } from "vitest";

import { formatCount, formatCurrencySymbol, formatGbp, formatMoney, formatPence } from "./money";

describe("formatGbp", () => {
  it("uses the auto rule by default: whole pounds bare, otherwise two decimals", () => {
    expect(formatGbp(0)).toBe("£0");
    expect(formatGbp(12)).toBe("£12");
    expect(formatGbp(12.5)).toBe("£12.50");
    expect(formatGbp(12.34)).toBe("£12.34");
    expect(formatGbp(1234567.5)).toBe("£1,234,567.50");
  });

  it("puts the minus sign before the pound sign", () => {
    expect(formatGbp(-5)).toBe("-£5");
    expect(formatGbp(-5.5)).toBe("-£5.50");
    expect(formatGbp(-1234.5, { decimals: 2 })).toBe("-£1,234.50");
    expect(formatGbp(-0)).toBe("£0");
  });

  it("formats whole pounds with decimals 0", () => {
    expect(formatGbp(1234.56, { decimals: 0 })).toBe("£1,235");
    expect(formatGbp(0, { decimals: 0 })).toBe("£0");
    expect(formatGbp(999999, { decimals: 0 })).toBe("£999,999");
  });

  it("formats pence with decimals 2", () => {
    expect(formatGbp(0, { decimals: 2 })).toBe("£0.00");
    expect(formatGbp(12, { decimals: 2 })).toBe("£12.00");
    expect(formatGbp(1080, { decimals: 2 })).toBe("£1,080.00");
    expect(formatGbp(0.07, { decimals: 2 })).toBe("£0.07");
  });

  it("keeps as many decimals as the amount has, up to two, with upTo2", () => {
    expect(formatGbp(12, { decimals: "upTo2" })).toBe("£12");
    expect(formatGbp(12.5, { decimals: "upTo2" })).toBe("£12.5");
    expect(formatGbp(12.345, { decimals: "upTo2" })).toBe("£12.35");
  });

  it("can drop the thousands separators", () => {
    expect(formatGbp(1234.5, { grouping: false })).toBe("£1234.50");
    expect(formatGbp(1234.5, { decimals: 0, grouping: false })).toBe("£1235");
  });

  it("changes the prefix", () => {
    expect(formatGbp(1500, { prefix: "" })).toBe("1,500");
    expect(formatGbp(120, { prefix: "GBP " })).toBe("GBP 120");
    expect(formatGbp(-120, { prefix: "GBP " })).toBe("-GBP 120");
  });

  it("shows a plus sign when asked, never for a negative", () => {
    expect(formatGbp(10, { showPlus: true })).toBe("+£10");
    expect(formatGbp(0, { showPlus: true })).toBe("+£0");
    expect(formatGbp(-10.5, { showPlus: true })).toBe("-£10.50");
  });

  it("rounds to whole pence first when asked", () => {
    expect(formatGbp(13.699999999, { roundToPence: true })).toBe("£13.70");
    expect(formatGbp(120.004, { roundToPence: true })).toBe("£120");
  });

  it("returns the fallback for a missing amount", () => {
    expect(formatGbp(null)).toBe("-");
    expect(formatGbp(undefined)).toBe("-");
    expect(formatGbp(Number.NaN)).toBe("-");
    expect(formatGbp(null, { fallback: "TBC" })).toBe("TBC");
  });
});

describe("formatPence", () => {
  it("shows integer pence as pounds with two decimals", () => {
    expect(formatPence(0)).toBe("£0.00");
    expect(formatPence(5)).toBe("£0.05");
    expect(formatPence(1999)).toBe("£19.99");
    expect(formatPence(108000)).toBe("£1,080.00");
    expect(formatPence(123456789)).toBe("£1,234,567.89");
    expect(formatPence(-250)).toBe("-£2.50");
  });

  it("returns the fallback for a missing amount", () => {
    expect(formatPence(null)).toBe("-");
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(12000)).toBe("12,000");
  });
});

describe("formatMoney and formatCurrencySymbol", () => {
  it("formats pounds in en-GB with up to two decimals", () => {
    expect(formatMoney(120, "GBP")).toBe("£120");
    expect(formatMoney(120.5, "GBP")).toBe("£120.5");
    expect(formatMoney(1234.56, "gbp")).toBe("£1,234.56");
    expect(formatMoney(1500)).toBe("£1,500");
  });

  it("falls back to the code for an unknown currency", () => {
    expect(formatMoney(12.5, "NOPE")).toBe("NOPE 12.50");
    expect(formatCurrencySymbol("NOPE")).toBe("NOPE");
  });

  it("returns the narrow symbol", () => {
    expect(formatCurrencySymbol("GBP")).toBe("£");
    expect(formatCurrencySymbol("usd")).toBe("$");
  });
});
