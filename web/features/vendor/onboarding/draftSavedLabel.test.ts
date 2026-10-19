import { describe, expect, it } from "vitest";
import { draftSavedLabel } from "./draftSavedLabel";

const NOW = Date.parse("2026-10-19T12:00:00Z");

describe("draftSavedLabel", () => {
  it("says just now under a minute", () => {
    expect(draftSavedLabel("2026-10-19T11:59:30Z", NOW)).toBe("just now");
  });
  it("counts minutes, hours and days", () => {
    expect(draftSavedLabel("2026-10-19T11:55:00Z", NOW)).toBe("5 min ago");
    expect(draftSavedLabel("2026-10-19T09:00:00Z", NOW)).toBe("3 h ago");
    expect(draftSavedLabel("2026-10-18T10:00:00Z", NOW)).toBe("yesterday");
    expect(draftSavedLabel("2026-10-15T12:00:00Z", NOW)).toBe("4 days ago");
  });
  it("returns null without a usable timestamp", () => {
    expect(draftSavedLabel(null, NOW)).toBeNull();
    expect(draftSavedLabel("not a date", NOW)).toBeNull();
  });
});
