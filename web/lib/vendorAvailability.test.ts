import { describe, expect, it } from "vitest";
import {
  explainVendorDateConflict,
  vendorBlockedDatesSentence,
  vendorUserIdsWithCalendarConflict,
  vendorWorkingDaysSentence,
} from "@/lib/vendorAvailability";

describe("vendorUserIdsWithCalendarConflict", () => {
  it("flags vendors whose calendar blocks the selected dates", () => {
    const conflictIds = vendorUserIdsWithCalendarConflict(
      [
        {
          user_id: "vendor-a",
          profile_form_data: { blockedDates: ["2026-09-20"] },
        },
        {
          user_id: "vendor-b",
          profile_form_data: { blockedDates: ["2026-10-01"] },
        },
      ],
      "2026-09-20",
      "",
    );

    expect(conflictIds).toEqual(["vendor-a"]);
  });
});

describe("vendor availability copy", () => {
  it("names the days the vendor takes bookings", () => {
    expect(vendorWorkingDaysSentence({ availableWeekdays: [5] })).toBe(
      "They take bookings on Saturday.",
    );
    expect(vendorWorkingDaysSentence({ availableWeekdays: [0, 1, 2, 3, 4] })).toBe(
      "They take bookings on Monday to Friday.",
    );
  });

  it("lists upcoming blocked dates and skips dates already passed", () => {
    expect(
      vendorBlockedDatesSentence(
        { blockedDates: ["2026-01-01", "2026-10-24", "2026-11-01"] },
        "2026-10-20",
      ),
    ).toBe("Unavailable on 24 Oct 2026 and 1 Nov 2026.");
  });

  it("says which chosen day is outside the vendor's week", () => {
    expect(explainVendorDateConflict({ availableWeekdays: [5] }, ["2026-10-25"])).toBe(
      "Sunday, 25 Oct 2026 is not a day they take bookings. They take bookings on Saturday.",
    );
  });

  it("says when the chosen day is blocked", () => {
    expect(
      explainVendorDateConflict(
        { availableWeekdays: [5], blockedDates: ["2026-10-24"] },
        ["2026-10-24"],
      ),
    ).toBe("Saturday, 24 Oct 2026 is marked unavailable. They take bookings on Saturday.");
  });
});
