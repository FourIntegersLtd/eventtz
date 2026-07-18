import { describe, expect, it } from "vitest";
import {
  marketplaceOverviewKpis,
  marketplaceSecondaryMeta,
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

  it("builds quiet secondary meta lines", () => {
    const kpis = marketplaceOverviewKpis({
      reply_within_1h_rate: 0.5,
      reply_within_6h_rate: 0.7,
      reply_within_24h_rate: 0.9,
      enquiry_vendor_reminders: 2,
      enquiry_client_nudges: 1,
      enquiry_multi_batches: 3,
    });
    expect(marketplaceSecondaryMeta(kpis)).toEqual([
      "Reply <1h 50.0% · <6h 70.0% · <24h 90.0%",
      "2 vendor nudges · 1 client nudges",
      "3 multi-vendor batches",
    ]);
  });
});
