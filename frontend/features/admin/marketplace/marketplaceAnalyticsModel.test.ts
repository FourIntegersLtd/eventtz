import { describe, expect, it } from "vitest";
import {
  marketplaceOverviewKpis,
  toMarketplaceCategoryBars,
  toMarketplaceCompletedSeries,
  toMarketplaceDemandSeries,
} from "@/features/admin/marketplace/marketplaceAnalyticsModel";

describe("marketplaceAnalyticsModel", () => {
  it("maps empty enquiry months to empty series", () => {
    expect(toMarketplaceDemandSeries([])).toEqual([]);
    expect(toMarketplaceCompletedSeries([])).toEqual([]);
  });

  it("maps monthly rows to chart points", () => {
    expect(toMarketplaceDemandSeries([{ month: "2026-01", count: 4 }])).toEqual([
      { date: "2026-01-01", value: 4 },
    ]);
  });

  it("maps category bars with raw labels (not dates)", () => {
    expect(
      toMarketplaceCategoryBars([
        {
          key: "Photography",
          enquiries: 10,
          accepted: 0,
          paid: 0,
          completed: 0,
          failed: 0,
          conversion_rate: 0,
          avg_booking_value_gbp: 0,
          revenue_gbp: 0,
        },
      ]),
    ).toEqual([{ label: "Photography", value: 10 }]);
  });

  it("defaults empty overview KPIs to zero", () => {
    expect(marketplaceOverviewKpis({})).toMatchObject({
      enquiries: 0,
      completed: 0,
      overallConversion: 0,
      unfulfilled: 0,
    });
  });

  it("reads overview KPI fields", () => {
    expect(
      marketplaceOverviewKpis({
        enquiries: 10,
        completed: 2,
        overall_conversion_rate: 0.2,
        unfulfilled: 3,
      }),
    ).toMatchObject({
      enquiries: 10,
      completed: 2,
      overallConversion: 0.2,
      unfulfilled: 3,
    });
  });
});
