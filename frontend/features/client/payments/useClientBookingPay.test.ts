import { describe, expect, it } from "vitest";
import { bookingNeedsVenue } from "@/features/client/payments/bookingPayHelpers";
import { parseForm, payVenueSchema } from "@/lib/validation";

describe("bookingNeedsVenue", () => {
  it("requires venue when address missing or blank", () => {
    expect(bookingNeedsVenue(undefined)).toBe(true);
    expect(bookingNeedsVenue(null)).toBe(true);
    expect(bookingNeedsVenue("")).toBe(true);
    expect(bookingNeedsVenue("   ")).toBe(true);
  });

  it("skips venue collection when address present", () => {
    expect(bookingNeedsVenue("12 Park Lane")).toBe(false);
  });
});

describe("payVenueSchema (pay page validation)", () => {
  it("rejects empty venue", () => {
    const parsed = parseForm(payVenueSchema, { eventAddress: "" });
    expect(parsed.ok).toBe(false);
  });

  it("accepts a venue address", () => {
    const parsed = parseForm(payVenueSchema, {
      eventAddress: "The Grand Hall, 12 Park Lane, London",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.eventAddress).toContain("Park Lane");
    }
  });
});
