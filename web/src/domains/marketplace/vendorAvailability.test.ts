import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isoDatesInEventRange,
  vendorPayloadAllowsEventDates,
  vendorUserIdsWithCalendarConflict,
} from "./vendorAvailability";

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

    assert.deepEqual(conflictIds, ["vendor-a"]);
  });

  it("rejects a weekday the vendor has not marked available", () => {
    // 2026-09-21 is a Monday. Stored weekdays use Monday = 0.
    const dates = isoDatesInEventRange("2026-09-21", null);
    assert.deepEqual(dates, ["2026-09-21"]);
    assert.equal(
      vendorPayloadAllowsEventDates({ availableWeekdays: [5, 6] }, dates),
      false,
    );
    assert.equal(
      vendorPayloadAllowsEventDates({ availableWeekdays: [0] }, dates),
      true,
    );
  });
});
