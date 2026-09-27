/**
 * The create-booking body has the schema's twelve keys and no prices.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBookingRequestPayload, type BookingRequestFormInput } from "./bookingRequestPayload";

const form: BookingRequestFormInput = {
  eventName: " Birthday ",
  eventDate: "2026-12-01",
  eventEndDate: "2026-12-02",
  venueAddress: " Leeds ",
  notes: " Garden ",
  selectedOptionIds: ["pkg-chairs"],
};

const payloadKeys = [
  "client_search_context",
  "event_address",
  "event_date",
  "event_end_date",
  "event_id",
  "event_name",
  "event_postcode",
  "notes",
  "quantities",
  "selected_option_ids",
  "vendor_referral_code",
  "vendor_user_id",
];

describe("buildBookingRequestPayload", () => {
  it("has exactly the twelve create-body keys and no price fields", () => {
    const payload = buildBookingRequestPayload(form, {
      vendorUserId: "vendor-1",
      selectedOptionIds: ["pkg-chairs"],
      quantities: { "pkg-chairs": 12 },
      quantityOptions: [{ id: "pkg-chairs", pricingMode: "per_unit", minQuantity: 10 }],
      clientSearchContext: { source: "browse", location: "Leeds" },
      eventId: "event-1",
      vendorReferralCode: "482910",
    });
    assert.deepStrictEqual(Object.keys(payload).sort(), payloadKeys);
    assert.deepStrictEqual(payload, {
      vendor_user_id: "vendor-1",
      event_name: "Birthday",
      event_date: "2026-12-01",
      event_end_date: "2026-12-02",
      event_postcode: null,
      event_address: "Leeds",
      notes: "Garden",
      selected_option_ids: ["pkg-chairs"],
      quantities: { "pkg-chairs": 12 },
      client_search_context: { source: "browse", location: "Leeds" },
      event_id: "event-1",
      vendor_referral_code: "482910",
    });
  });

  it("sends no quantities entry for a fixed-price option", () => {
    const payload = buildBookingRequestPayload(
      { ...form, selectedOptionIds: ["pkg-gold"] },
      {
        vendorUserId: "vendor-1",
        selectedOptionIds: ["pkg-gold"],
        quantities: { "pkg-gold": 3 },
        quantityOptions: [{ id: "pkg-gold", pricingMode: "fixed", minQuantity: 1 }],
        clientSearchContext: { source: "browse" },
        eventId: null,
        vendorReferralCode: null,
      },
    );
    assert.equal(payload.quantities, null);
    assert.deepStrictEqual(payload.selected_option_ids, ["pkg-gold"]);
  });

  it("clamps a per-unit option below its minimum", () => {
    const payload = buildBookingRequestPayload(form, {
      vendorUserId: "vendor-1",
      selectedOptionIds: ["pkg-chairs"],
      quantities: { "pkg-chairs": 3 },
      quantityOptions: [{ id: "pkg-chairs", pricingMode: "per_unit", minQuantity: 10 }],
      clientSearchContext: null,
      eventId: null,
      vendorReferralCode: "12-34",
    });
    assert.deepStrictEqual(payload.quantities, { "pkg-chairs": 10 });
    assert.equal(payload.vendor_referral_code, "1234");
    assert.equal(payload.client_search_context, null);
  });
});
