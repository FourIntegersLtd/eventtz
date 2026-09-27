/**
 * Client booking enquiry checks, ported from the baseline submit test.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBookingRequestPayload } from "./bookingRequestPayload";
import { validateClientBookingEnquiry } from "./bookingRequestValidation";

const TODAY = "2026-06-15";

function fields(overrides: Partial<Parameters<typeof validateClientBookingEnquiry>[0]> = {}) {
  return {
    eventName: "Birthday",
    eventDate: "2026-12-01",
    eventEndDate: "",
    venueAddress: "",
    notes: "",
    selectedOptionIds: ["pkg-1"],
    ...overrides,
  };
}

describe("client booking enquiry validation", () => {
  it("blocks submit when calendar conflicts", () => {
    const result = validateClientBookingEnquiry(fields(), true, TODAY);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /availability/i);
    }
  });

  it("returns validation errors from zod", () => {
    const result = validateClientBookingEnquiry(fields({ eventName: "" }), false, TODAY);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /event name/i);
    }
  });

  it("builds a create payload when validation passes", () => {
    const result = validateClientBookingEnquiry(
      fields({
        venueAddress: "London",
        notes: "Garden party",
      }),
      false,
      TODAY,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const payload = buildBookingRequestPayload(result.data, {
        vendorUserId: "vendor-1",
        selectedOptionIds: ["pkg-1"],
        quantities: { "pkg-1": 10 },
        clientSearchContext: { source: "browse" },
        eventId: "event-1",
        vendorReferralCode: "123456",
      });
      assert.equal(payload.vendor_user_id, "vendor-1");
      assert.equal(payload.event_name, "Birthday");
      assert.deepStrictEqual(payload.selected_option_ids, ["pkg-1"]);
      assert.deepStrictEqual(payload.quantities, { "pkg-1": 10 });
      assert.equal(payload.vendor_referral_code, "123456");
      assert.equal(payload.event_id, "event-1");
    }
  });
});

describe("booking request date messages", () => {
  it("asks for an event date when the start is missing", () => {
    const result = validateClientBookingEnquiry(fields({ eventDate: "" }), false, TODAY);
    assert.deepStrictEqual(result, { ok: false, error: "Choose an event date." });
  });

  it("rejects an event date that cannot be parsed", () => {
    const result = validateClientBookingEnquiry(fields({ eventDate: "not-a-date" }), false, TODAY);
    assert.deepStrictEqual(result, { ok: false, error: "Choose a valid event date." });
  });

  it("rejects an event date before the fixed today", () => {
    const result = validateClientBookingEnquiry(fields({ eventDate: "2026-06-14" }), false, TODAY);
    assert.deepStrictEqual(result, { ok: false, error: "Event date cannot be in the past." });
  });

  it("rejects an end date before the fixed today", () => {
    const result = validateClientBookingEnquiry(
      fields({ eventDate: "2026-12-01", eventEndDate: "2026-06-01" }),
      false,
      TODAY,
    );
    assert.deepStrictEqual(result, { ok: false, error: "End date cannot be in the past." });
  });

  it("rejects an end date before the event date", () => {
    const result = validateClientBookingEnquiry(
      fields({ eventDate: "2026-12-02", eventEndDate: "2026-12-01" }),
      false,
      TODAY,
    );
    assert.deepStrictEqual(result, { ok: false, error: "End date must be on or after the event date." });
  });
});
