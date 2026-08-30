import { describe, expect, it } from "vitest";
import { buildBookingRequestPayload } from "@/lib/bookingEnquireSubmit";
import { clientBookingRequestSchema } from "@/lib/validation/bookings";
import { parseForm } from "@/lib/validation/helpers";

const CALENDAR_CONFLICT_MESSAGE =
  "These dates don't match this vendor's availability. Adjust the dates or message them to confirm.";

function validateEnquiryFields(
  fields: {
    eventName: string;
    eventDate: string;
    eventEndDate: string;
    venueAddress: string;
    notes: string;
    selectedOptionIds: string[];
  },
  calendarConflict: boolean,
) {
  const parsed = parseForm(clientBookingRequestSchema, {
    eventName: fields.eventName,
    eventDate: fields.eventDate,
    eventEndDate: fields.eventEndDate || null,
    venueAddress: fields.venueAddress,
    notes: fields.notes,
    selectedOptionIds: fields.selectedOptionIds,
  });
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.formError };
  }
  if (calendarConflict) {
    return { ok: false as const, error: CALENDAR_CONFLICT_MESSAGE };
  }
  return { ok: true as const, parsed: parsed.data };
}

describe("client booking enquiry validation", () => {
  it("blocks submit when calendar conflicts", () => {
    const result = validateEnquiryFields(
      {
        eventName: "Birthday",
        eventDate: "2026-12-01",
        eventEndDate: "",
        venueAddress: "",
        notes: "",
        selectedOptionIds: ["pkg-1"],
      },
      true,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/availability/i);
    }
  });

  it("returns validation errors from zod", () => {
    const result = validateEnquiryFields(
      {
        eventName: "",
        eventDate: "2026-12-01",
        eventEndDate: "",
        venueAddress: "",
        notes: "",
        selectedOptionIds: ["pkg-1"],
      },
      false,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/event name/i);
    }
  });

  it("builds a create payload when validation passes", () => {
    const result = validateEnquiryFields(
      {
        eventName: "Birthday",
        eventDate: "2026-12-01",
        eventEndDate: "",
        venueAddress: "London",
        notes: "Garden party",
        selectedOptionIds: ["pkg-1"],
      },
      false,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        buildBookingRequestPayload(result.parsed, {
          vendorUserId: "vendor-1",
          selectedOptionIds: ["pkg-1"],
          quantities: { "pkg-1": 10 },
          clientSearchContext: { source: "browse" },
          eventId: "event-1",
          vendorReferralCode: "123456",
        }),
      ).toMatchObject({
        vendor_user_id: "vendor-1",
        event_name: "Birthday",
        selected_option_ids: ["pkg-1"],
        quantities: { "pkg-1": 10 },
        vendor_referral_code: "123456",
        event_id: "event-1",
      });
    }
  });
});
