import { describe, expect, it } from "vitest";
import { PAYMENT_SAFETY_COPY } from "@/features/bookings/bookingConfirmCopy";
import { bookingCanBePaid, bookingNeedsVenue } from "@/features/client/payments/bookingPayHelpers";
import { parseForm, payVenueSchema } from "@/lib/validation";

describe("PAYMENT_SAFETY_COPY", () => {
  it("explains fund protection and the 48-hour dispute window in a reassuring tone", () => {
    expect(PAYMENT_SAFETY_COPY.points).toHaveLength(4);
    expect(PAYMENT_SAFETY_COPY.points.join(" ")).toContain("48 hours");
    expect(PAYMENT_SAFETY_COPY.points.join(" ")).toContain("safely");
    expect(PAYMENT_SAFETY_COPY.points.join(" ")).not.toMatch(/-|-/);
  });
});

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

describe("bookingCanBePaid", () => {
  it("allows checkout only for accepted unpaid or pending bookings", () => {
    expect(
      bookingCanBePaid({ booking_status: "accepted", payment_status: "unpaid" }),
    ).toBe(true);
    expect(
      bookingCanBePaid({ booking_status: "accepted", payment_status: "pending" }),
    ).toBe(true);
  });

  it("blocks checkout when the booking is not accepted or already paid", () => {
    expect(
      bookingCanBePaid({ booking_status: "pending", payment_status: "unpaid" }),
    ).toBe(false);
    expect(
      bookingCanBePaid({ booking_status: "accepted", payment_status: "paid" }),
    ).toBe(false);
    expect(
      bookingCanBePaid({ booking_status: "declined", payment_status: "unpaid" }),
    ).toBe(false);
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
