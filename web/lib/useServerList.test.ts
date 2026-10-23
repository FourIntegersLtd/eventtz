import { describe, expect, it } from "vitest";
import { failedOutcome, nextOffset, previousOffset, resolveOffset, serverListKey } from "@/lib/useServerList";

describe("server list paging", () => {
  it("advances a page of 25 through 60 rows and stops on the last page", () => {
    expect(nextOffset(0, 25, 60)).toBe(25);
    expect(nextOffset(25, 25, 60)).toBe(50);
    expect(nextOffset(50, 25, 60)).toBe(50);
  });

  it("does not advance when the total exactly fills one page or is empty", () => {
    expect(nextOffset(0, 25, 25)).toBe(0);
    expect(nextOffset(0, 25, 0)).toBe(0);
  });

  it("steps back a page and never goes below the first", () => {
    expect(previousOffset(50, 25)).toBe(25);
    expect(previousOffset(25, 25)).toBe(0);
    expect(previousOffset(10, 25)).toBe(0);
  });

  it("keeps the offset while the filters and search are unchanged", () => {
    const key = serverListKey({ tab: "active" }, "ann");
    expect(resolveOffset({ key, offset: 50 }, key)).toBe(50);
  });

  it("returns to offset 0 when a filter changes", () => {
    const before = serverListKey({ tab: "active" }, "");
    const after = serverListKey({ tab: "closed" }, "");
    expect(resolveOffset({ key: before, offset: 50 }, after)).toBe(0);
  });

  it("returns to offset 0 when the search text changes", () => {
    const before = serverListKey({ tab: "active" }, "ann");
    const after = serverListKey({ tab: "active" }, "anna");
    expect(resolveOffset({ key: before, offset: 25 }, after)).toBe(0);
  });

  it("ignores surrounding spaces in the search text", () => {
    expect(serverListKey({ tab: "active" }, " ann ")).toBe(serverListKey({ tab: "active" }, "ann"));
  });
});

describe("server list failed fetch", () => {
  it("keeps the last good rows and total and surfaces the error", () => {
    const lastGood = { requestKey: "a", items: ["row 1", "row 2"], total: 40, error: null };
    expect(failedOutcome(lastGood, "b", "Could not load this list.")).toEqual({
      requestKey: "b",
      items: ["row 1", "row 2"],
      total: 40,
      error: "Could not load this list.",
    });
  });
});
