import { describe, expect, it } from "vitest";
import { buildBookingRequestPayload } from "@/lib/bookingEnquireSubmit";

describe("buildBookingRequestPayload", () => {
  it("maps validated form fields to create payload", () => {
    const payload = buildBookingRequestPayload(
      {
        eventName: "Birthday",
        eventDate: "2026-09-20",
        eventEndDate: "2026-09-21",
        venueAddress: " Leeds ",
        notes: " Outdoor ",
        selectedOptionIds: ["pkg-1"],
        quantities: { "pkg-1": 20 },
      },
      {
        vendorUserId: "vendor-1",
        selectedOptionIds: ["pkg-1"],
        quantities: { "pkg-1": 20 },
        clientSearchContext: { source: "browse" },
        eventId: "event-1",
        vendorReferralCode: "482910",
      },
    );

    expect(payload).toEqual({
      vendor_user_id: "vendor-1",
      event_name: "Birthday",
      event_date: "2026-09-20",
      event_end_date: "2026-09-21",
      event_postcode: null,
      event_address: "Leeds",
      notes: "Outdoor",
      selected_option_ids: ["pkg-1"],
      quantities: { "pkg-1": 20 },
      client_search_context: { source: "browse" },
      event_id: "event-1",
      vendor_referral_code: "482910",
    });
  });
});
