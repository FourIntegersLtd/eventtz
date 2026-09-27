import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldMergeGuestFavorites } from "./marketplaceBookmarkMerge";

describe("shouldMergeGuestFavorites", () => {
  it("merges when local ids exist and this client has not merged yet", () => {
    assert.strictEqual(
      shouldMergeGuestFavorites(["vendor-1"], null, "client-abc"),
      true,
    );
  });

  it("skips merge when marker matches the signed-in client", () => {
    assert.strictEqual(
      shouldMergeGuestFavorites(["vendor-1"], "client-abc", "client-abc"),
      false,
    );
  });

  it("skips merge when local storage is empty", () => {
    assert.strictEqual(shouldMergeGuestFavorites([], null, "client-abc"), false);
  });
});
