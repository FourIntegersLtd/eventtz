/**
 * Tests for vendor portfolio image helpers.
 * Ported from the baseline `vendorPortfolioImages.test.ts`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultListingDisplayOrder,
  listingCoverImageUrlFromPayload,
  publicListingImageUrlsFromPayload,
} from "./vendorPortfolioImages";

const PROFILE = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/profile.jpg";
const A = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/a.jpg";
const B = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/b.jpg";

function payload(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    profileImageUrl: PROFILE,
    portfolioFileNames: [A, B],
    ...extra,
  };
}

describe("publicListingImageUrlsFromPayload", () => {
  it("defaults to profile photo then portfolio", () => {
    assert.strictEqual(defaultListingDisplayOrder(payload())[0], PROFILE);
    assert.deepStrictEqual(publicListingImageUrlsFromPayload(payload()), [PROFILE, A, B]);
  });

  it("uses listingDisplayOrder when set", () => {
    const urls = publicListingImageUrlsFromPayload(
      payload({ listingDisplayOrder: [B, A, PROFILE] }),
    );
    assert.strictEqual(urls[0], B);
    assert.strictEqual(
      listingCoverImageUrlFromPayload(payload({ listingDisplayOrder: [B, A, PROFILE] })),
      B,
    );
  });

  it("omits hidden urls from public order", () => {
    const urls = publicListingImageUrlsFromPayload(
      payload({ listingHiddenImageUrls: [PROFILE] }),
    );
    assert.deepStrictEqual(urls, [A, B]);
  });

  it("promotes legacy listingCoverImageUrl when no display order", () => {
    assert.strictEqual(
      listingCoverImageUrlFromPayload(payload({ listingCoverImageUrl: B })),
      B,
    );
  });
});
