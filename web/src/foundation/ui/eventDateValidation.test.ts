import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_DATE_PAST_ERROR,
  EVENT_END_DATE_PAST_ERROR,
  isPastIsoDate,
  normalizeIsoDate,
  todayIsoDate,
  validateEventDates,
} from "@/foundation/ui/eventDateValidation";

test("todayIsoDate is today's local calendar date", () => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  assert.equal(todayIsoDate(), `${year}-${month}-${day}`);
});

test("a date in 1999 is in the past and a date in 2999 is not", () => {
  assert.equal(normalizeIsoDate("  1999-12-31T00:00:00"), "1999-12-31");
  assert.equal(normalizeIsoDate("not-a-date"), null);
  assert.equal(isPastIsoDate("1999-12-31"), true);
  assert.equal(isPastIsoDate("2999-01-01"), false);
  assert.equal(validateEventDates("1999-06-15"), EVENT_DATE_PAST_ERROR);
  assert.equal(validateEventDates("2999-06-15", "1999-01-01"), EVENT_END_DATE_PAST_ERROR);
  assert.equal(validateEventDates("2999-06-15", "2999-06-14"), "End date must be on or after the event date.");
  assert.equal(validateEventDates("2999-06-15", "2999-06-16"), null);
});
