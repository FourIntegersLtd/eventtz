import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMoneyGbp,
  formatPercent,
  formatSecondsDuration,
  monthShortLabel,
  seriesMax,
  toMonthSeries,
} from "@/domains/vendor-analytics/analyticsFormat";

describe("formatMoneyGbp", () => {
  it("formats a whole-pound amount with the currency symbol and grouping", () => {
    assert.equal(formatMoneyGbp(1234), "£1,234");
  });

  it("treats a missing amount as zero", () => {
    assert.equal(formatMoneyGbp(null), "£0");
    assert.equal(formatMoneyGbp(undefined), "£0");
  });
});

describe("formatPercent", () => {
  it("rounds a 0-1 rate to a whole percentage", () => {
    assert.equal(formatPercent(0.256), "26%");
    assert.equal(formatPercent(1), "100%");
  });

  it("shows an em dash for a missing rate", () => {
    assert.equal(formatPercent(null), "—");
    assert.equal(formatPercent(undefined), "—");
  });
});

describe("formatSecondsDuration", () => {
  it("formats sub-minute durations in seconds", () => {
    assert.equal(formatSecondsDuration(45), "45s");
  });

  it("formats sub-hour durations in minutes", () => {
    assert.equal(formatSecondsDuration(150), "3m");
  });

  it("formats hour-scale durations in hours", () => {
    assert.equal(formatSecondsDuration(5400), "1.5h");
    assert.equal(formatSecondsDuration(36000), "10h");
  });

  it("shows an em dash for a missing duration", () => {
    assert.equal(formatSecondsDuration(null), "—");
  });
});

describe("monthShortLabel", () => {
  it("turns an ISO year-month into a short month name", () => {
    assert.equal(monthShortLabel("2026-02"), "Feb");
    assert.equal(monthShortLabel("2025-12"), "Dec");
  });

  it("returns the input unchanged if it does not parse", () => {
    assert.equal(monthShortLabel("not-a-month"), "not-a-month");
  });
});

describe("toMonthSeries", () => {
  it("maps rows to labelled bars, treating null values as zero", () => {
    const rows = [
      { month: "2026-01", count: 3 },
      { month: "2026-02", count: null },
    ];
    assert.deepEqual(toMonthSeries(rows, "count"), [
      { label: "Jan", value: 3 },
      { label: "Feb", value: 0 },
    ]);
  });
});

describe("seriesMax", () => {
  it("returns the highest value in the series", () => {
    assert.equal(seriesMax([{ label: "a", value: 2 }, { label: "b", value: 9 }]), 9);
  });

  it("returns 1 for an empty or all-zero series so bar widths stay finite", () => {
    assert.equal(seriesMax([]), 1);
    assert.equal(seriesMax([{ label: "a", value: 0 }]), 1);
  });
});
