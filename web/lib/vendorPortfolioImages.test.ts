import { describe, expect, it } from "vitest";
import {
  defaultListingDisplayOrder,
  listingCoverImageUrlFromPayload,
  publicListingImageUrlsFromPayload,
} from "@/lib/vendorPortfolioImages";

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
    expect(defaultListingDisplayOrder(payload())[0]).toBe(PROFILE);
    expect(publicListingImageUrlsFromPayload(payload())).toEqual([PROFILE, A, B]);
  });

  it("uses listingDisplayOrder when set", () => {
    const urls = publicListingImageUrlsFromPayload(
      payload({ listingDisplayOrder: [B, A, PROFILE] }),
    );
    expect(urls[0]).toBe(B);
    expect(listingCoverImageUrlFromPayload(payload({ listingDisplayOrder: [B, A, PROFILE] }))).toBe(
      B,
    );
  });

  it("omits hidden urls from public order", () => {
    const urls = publicListingImageUrlsFromPayload(
      payload({ listingHiddenImageUrls: [PROFILE] }),
    );
    expect(urls).toEqual([A, B]);
  });

  it("promotes legacy listingCoverImageUrl when no display order", () => {
    expect(
      listingCoverImageUrlFromPayload(payload({ listingCoverImageUrl: B })),
    ).toBe(B);
  });
});
