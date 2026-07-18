import { describe, expect, it } from "vitest";
import {
  commercePeriodRange,
  formatCommerceDateRange,
} from "@/features/admin/commerce/commercePeriod";

describe("commercePeriod", () => {
  it("builds inclusive trailing windows", () => {
    const now = new Date(Date.UTC(2026, 6, 18));
    expect(commercePeriodRange(30, now)).toEqual({
      from: "2026-06-19",
      to: "2026-07-18",
    });
    expect(commercePeriodRange(1, now)).toEqual({
      from: "2026-07-18",
      to: "2026-07-18",
    });
  });

  it("formats ranges for the filter chip", () => {
    expect(formatCommerceDateRange("2026-06-19", "2026-07-18")).toMatch(/19.*Jun.*2026/);
    expect(formatCommerceDateRange("2026-06-19", "2026-07-18")).toMatch(/18.*Jul.*2026/);
  });
});
