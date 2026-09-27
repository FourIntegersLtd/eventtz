import assert from "node:assert/strict";
import test from "node:test";
import {
  dayOptions,
  daysInMonth,
  isoToParts,
  monthLabel,
  monthOptions,
  partsToIso,
} from "@/foundation/ui/isoDateParts";

test("February has 29 days in a leap year and 28 otherwise", () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
  assert.equal(partsToIso(2024, 2, 29), "2024-02-29");
  assert.equal(partsToIso(2023, 2, 29), null);
  assert.deepEqual(isoToParts("2024-02-29"), { year: 2024, month: 2, day: 29 });
});

test("minIso trims a time suffix and drops earlier days and months", () => {
  assert.deepEqual(isoToParts("  2026-09-15T08:30:00"), { year: 2026, month: 9, day: 15 });
  assert.deepEqual(monthOptions(2026, "2026-09-15T08:30:00"), [9, 10, 11, 12]);
  assert.deepEqual(dayOptions(2026, 9, "2026-09-15T08:30:00"), [
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  ]);
  assert.equal(monthLabel(2), "Feb");
});
