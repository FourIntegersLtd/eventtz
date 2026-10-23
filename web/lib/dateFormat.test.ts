import { beforeAll, describe, expect, it } from "vitest";

import {
  DATE_STYLES,
  type DateStyle,
  formatDate,
  formatDateTime,
  formatDateTimeSeconds,
  formatEventDate,
} from "./dateFormat";

/** British Summer Time and winter time both appear below, so pin the zone the tests run in. */
beforeAll(() => {
  process.env.TZ = "Europe/London";
});

const SUMMER = new Date("2026-07-12T13:03:09Z"); // BST: 14:03 in London, a Sunday
const WINTER = new Date("2026-01-05T09:07:00Z"); // GMT: 09:07 in London, a Monday
const SUMMER_LATE = new Date("2026-07-12T23:30:00Z"); // 00:30 on 13 Jul in London

describe("formatDate", () => {
  it.each<[DateStyle, string, string]>([
    ["dayMonth", "12 Jul", "5 Jan"],
    ["dayMonthYear", "12 Jul 2026", "5 Jan 2026"],
    ["dayLongMonthYear", "12 July 2026", "5 January 2026"],
    ["monthYear", "Jul 2026", "Jan 2026"],
    ["longMonthYear", "July 2026", "January 2026"],
    ["monthShort", "Jul", "Jan"],
    ["weekdayDayMonth", "Sun 12 Jul", "Mon 5 Jan"],
    ["weekdayDayMonthYear", "Sun, 12 Jul 2026", "Mon, 5 Jan 2026"],
    ["longWeekdayDayMonthYear", "Sunday, 12 Jul 2026", "Monday, 5 Jan 2026"],
    ["longWeekdayDayLongMonth", "Sunday 12 July", "Monday 5 January"],
    ["dateMedium", "12 Jul 2026", "5 Jan 2026"],
    ["dateTimeMedium", "12 Jul 2026, 14:03", "5 Jan 2026, 09:07"],
    ["dateTimeShort", "12/07/2026, 14:03", "05/01/2026, 09:07"],
    ["dayMonthTime", "12 Jul, 14:03", "5 Jan, 09:07"],
    ["time", "14:03", "09:07"],
  ])("%s", (style, summerText, winterText) => {
    expect(formatDate(SUMMER, style)).toBe(summerText);
    expect(formatDate(WINTER, style)).toBe(winterText);
  });

  it("covers every named style", () => {
    expect(Object.keys(DATE_STYLES)).toHaveLength(15);
  });

  it("shows local time across midnight in British Summer Time", () => {
    expect(formatDate(SUMMER_LATE, "dayMonth")).toBe("13 Jul");
    expect(formatDate(SUMMER_LATE, "time")).toBe("00:30");
  });

  it("keeps a noon-UTC date on its own day with the UTC option", () => {
    expect(formatDate(new Date("2026-07-12T12:00:00Z"), "dayMonthYear", "UTC")).toBe("12 Jul 2026");
    expect(formatDate(new Date("2026-07-12T23:30:00Z"), "dayMonth", "UTC")).toBe("12 Jul");
    expect(formatDate(new Date("2026-03-01T12:00:00Z"), "monthShort", "UTC")).toBe("Mar");
  });
});

describe("invalid dates", () => {
  it("returns Invalid Date instead of throwing", () => {
    expect(formatDate(new Date("nope"), "dayMonthYear")).toBe("Invalid Date");
  });
});

describe("formatDateTimeSeconds", () => {
  it("shows the numeric date with seconds", () => {
    expect(formatDateTimeSeconds(SUMMER)).toBe("12/07/2026, 14:03:09");
  });
});

describe("formatEventDate and formatDateTime", () => {
  it("formats a plain event date", () => {
    expect(formatEventDate("2026-07-12")).toBe("Sun, 12 Jul 2026");
    expect(formatEventDate("2026-12-25T00:00:00Z")).toBe("Fri, 25 Dec 2026");
    expect(formatEventDate("")).toBe("");
    expect(formatEventDate("bad")).toBe("bad");
  });

  it("formats a timestamp, with a dash when missing and the raw text when invalid", () => {
    expect(formatDateTime("2026-07-12T13:03:09Z")).toBe("12 Jul 2026, 14:03");
    expect(formatDateTime("2026-01-05T09:07:00Z")).toBe("5 Jan 2026, 09:07");
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("not a date")).toBe("not a date");
  });
});
