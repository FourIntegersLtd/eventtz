import { describe, expect, it } from "vitest";
import { vendorUserIdsWithCalendarConflict } from "@/lib/vendorAvailability";

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
