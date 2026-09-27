import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { marketplacePaginationWindow } from "./marketplacePaginationWindow";

describe("marketplacePaginationWindow", () => {
  it("lists every page when there are at most seven", () => {
    assert.deepStrictEqual(marketplacePaginationWindow(2, 5), [1, 2, 3, 4, 5]);
  });

  it("collapses the middle with ellipses on large page counts", () => {
    assert.deepStrictEqual(marketplacePaginationWindow(5, 12), [
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      12,
    ]);
  });
});
