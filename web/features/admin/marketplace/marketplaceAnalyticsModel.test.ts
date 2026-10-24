import { describe, expect, it } from "vitest";
import type { AdminMarketplaceAnalytics } from "@/lib/adminDashboardApi";
import {
  marketplaceOverviewKpis,
  marketplaceSecondaryMeta,
  toMarketplaceCategoryBars,
  toMarketplaceCompletedSeries,
  toMarketplaceDemandSeries,
} from "@/features/admin/marketplace/marketplaceAnalyticsModel";

/** An overview as the API sends it for an empty range, with `changes` laid over it. */
function overviewWith(changes: Partial<AdminMarketplaceAnalytics["overview"]>) {
  return {
    vendors_total: 0,
    vendors_active: 0,
    enquiries: 0,
    accepted: 0,
    paid: 0,
    completed: 0,
    enquiry_to_acceptance_rate: 0,
    acceptance_to_payment_rate: 0,
    overall_conversion_rate: 0,
    avg_booking_value_gbp: 0,
    avg_vendor_response_seconds: null,
    reply_within_1h_rate: null,
    reply_within_6h_rate: null,
    reply_within_24h_rate: null,
    enquiry_vendor_reminders: 0,
    enquiry_client_nudges: 0,
    enquiry_multi_batches: 0,
    avg_customer_rating: 0,
    review_count: 0,
    profile_views: 0,
    unfulfilled: 0,
    ...changes,
  };
}

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
          accept_rate: 0,
          conversion_rate: 0,
          avg_booking_value_gbp: 0,
          revenue_gbp: 0,
        },
      ]),
    ).toEqual([{ label: "Photography", value: 10 }]);
  });

  it("defaults empty overview KPIs to zero", () => {
    expect(marketplaceOverviewKpis(overviewWith({}))).toMatchObject({
      enquiries: 0,
      completed: 0,
      overallConversion: 0,
      unfulfilled: 0,
    });
  });

  it("reads overview KPI fields", () => {
    expect(
      marketplaceOverviewKpis(
        overviewWith({
          enquiries: 10,
          completed: 2,
          overall_conversion_rate: 0.2,
          unfulfilled: 3,
        }),
      ),
    ).toMatchObject({
      enquiries: 10,
      completed: 2,
      overallConversion: 0.2,
      unfulfilled: 3,
    });
  });

  it("builds quiet secondary meta lines", () => {
    const kpis = marketplaceOverviewKpis(
      overviewWith({
        reply_within_1h_rate: 0.5,
        reply_within_6h_rate: 0.7,
        reply_within_24h_rate: 0.9,
        enquiry_vendor_reminders: 2,
        enquiry_client_nudges: 1,
        enquiry_multi_batches: 3,
      }),
    );
    expect(marketplaceSecondaryMeta(kpis)).toEqual([
      "Reply <1h 50.0% · <6h 70.0% · <24h 90.0%",
      "2 vendor nudges · 1 client nudges",
      "3 multi-vendor batches",
    ]);
  });
});
