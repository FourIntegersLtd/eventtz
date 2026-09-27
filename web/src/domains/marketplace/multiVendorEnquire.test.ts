/**
 * Three vendors become three bodies. None, some, and all map to the baseline copy.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMultiVendorEnquirePayloads,
  defaultOptionIdForVendor,
  initialOptionSelections,
  REQUESTS_NOT_SENT,
  summarizeMultiVendorSend,
  type MultiVendorRow,
} from "./multiVendorEnquire";
import type { BookingRequestFormInput } from "./bookingRequestPayload";
import type { CreateBookingRequestBody } from "./api";

const form: BookingRequestFormInput = {
  eventName: "Garden party",
  eventDate: "2026-12-01",
  eventEndDate: null,
  venueAddress: "Leeds",
  notes: "",
  selectedOptionIds: ["basic"],
};

function vendor(userId: string, packages: { id: string; title: string; price: string }[]): MultiVendorRow {
  return {
    user_id: userId,
    profile_form_data: {
      businessName: `Vendor ${userId}`,
      packages,
    },
  };
}

function payloadHasMoneyKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("price") ||
      lower.includes("total") ||
      lower.includes("amount") ||
      lower.includes("fee")
    ) {
      return true;
    }
    if (payloadHasMoneyKey(child)) return true;
  }
  return false;
}

describe("multi-vendor enquire", () => {
  it("preselects the cheapest package for each vendor", () => {
    const first = vendor("v1", [
      { id: "premium", title: "Premium", price: "500" },
      { id: "basic", title: "Basic", price: "200" },
    ]);
    const second = vendor("v2", [{ id: "gold", title: "Gold", price: "150" }]);
    assert.equal(defaultOptionIdForVendor(first), "basic");
    assert.deepEqual(initialOptionSelections([first, second]), { v1: "basic", v2: "gold" });
  });

  it("builds one payload per vendor with batch index 0, 1 and 2", () => {
    const payloads = buildMultiVendorEnquirePayloads({
      form,
      enquirySource: "multi",
      eventId: null,
      clientSearchContext: { location: "Leeds", q: "dj" },
      choices: [
        {
          userId: "v1",
          optionId: "basic",
          quantityOptions: [{ id: "basic", pricingMode: "fixed", minQuantity: 1 }],
        },
        {
          userId: "v2",
          optionId: "chairs",
          quantity: 2,
          quantityOptions: [{ id: "chairs", pricingMode: "per_unit", minQuantity: 4 }],
        },
        {
          userId: "v3",
          optionId: "gold",
          quantityOptions: [{ id: "gold", pricingMode: "fixed", minQuantity: 1 }],
        },
      ],
    });
    assert.equal(payloads.length, 3);
    assert.deepEqual(
      payloads.map((payload) => payload.selected_option_ids),
      [["basic"], ["chairs"], ["gold"]],
    );
    assert.deepEqual(
      payloads.map((payload) => payload.client_search_context),
      [
        { location: "Leeds", q: "dj", batchSize: 3, batchIndex: 0, source: "multi" },
        { location: "Leeds", q: "dj", batchSize: 3, batchIndex: 1, source: "multi" },
        { location: "Leeds", q: "dj", batchSize: 3, batchIndex: 2, source: "multi" },
      ],
    );
    assert.equal(payloads[0]?.quantities, null);
    assert.deepEqual(payloads[1]?.quantities, { chairs: 4 });
    assert.equal(payloads[2]?.quantities, null);
    for (const payload of payloads) {
      assert.equal(payloadHasMoneyKey(payload), false);
      assert.equal(payload.selected_option_ids.length, 1);
    }
  });

  it("summarises none, partial, and all-success", () => {
    const none = summarizeMultiVendorSend(0, 3);
    assert.equal(none.kind, "none");
    assert.equal(none.kind === "none" ? none.message : "", "Requests not sent");
    assert.equal(REQUESTS_NOT_SENT, "Requests not sent");
    const partial = summarizeMultiVendorSend(2, 3);
    assert.equal(partial.kind, "partial");
    assert.equal(partial.kind === "partial" && partial.message, "2 of 3 requests sent");
    assert.deepEqual(summarizeMultiVendorSend(3, 3), { kind: "all" });
  });

  it("keeps a planner source already on the search context", () => {
    const payloads: CreateBookingRequestBody[] = buildMultiVendorEnquirePayloads({
      form,
      enquirySource: "multi",
      clientSearchContext: { source: "planner", plannerPlanId: "plan-1" },
      choices: [
        {
          userId: "v1",
          optionId: "basic",
          quantityOptions: [{ id: "basic", pricingMode: "fixed", minQuantity: 1 }],
        },
      ],
    });
    assert.deepEqual(payloads[0]?.client_search_context, {
      source: "planner",
      plannerPlanId: "plan-1",
      batchSize: 1,
      batchIndex: 0,
    });
  });
});
