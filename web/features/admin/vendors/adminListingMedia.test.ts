import { describe, expect, it } from "vitest";
import {
  adminListingMediaItemsFromPayload,
  adminListingMediaStateFromItems,
} from "@/features/admin/vendors/adminListingMedia";

const ROOT = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1";
const PROFILE = `${ROOT}/profile.jpg`;
const PHOTO_A = `${ROOT}/a.jpg`;
const PHOTO_B = `${ROOT}/b.jpg`;
/** A portfolio photo the vendor deleted after staff saved an order. */
const REMOVED = `${ROOT}/removed.jpg`;
/** The profile photo the vendor replaced after staff saved an order. */
const OLD_PROFILE = `${ROOT}/old-profile.jpg`;

describe("adminListingMediaItemsFromPayload", () => {
  it("ignores saved order and hidden URLs for photos that are no longer current", () => {
    const items = adminListingMediaItemsFromPayload({
      profileImageUrl: PROFILE,
      portfolioFileNames: [PHOTO_A, PHOTO_B],
      listingDisplayOrder: [PHOTO_B, REMOVED, OLD_PROFILE, PHOTO_A, PROFILE],
      listingHiddenImageUrls: [REMOVED],
    });

    expect(items.map((item) => item.url)).toEqual([PHOTO_B, PHOTO_A, PROFILE]);
    // What a drag would send: only photos the api's listing-media check accepts.
    expect(adminListingMediaStateFromItems(items)).toEqual({
      displayOrder: [PHOTO_B, PHOTO_A, PROFILE],
      hiddenImageUrls: [],
    });
  });

  it("keeps the saved order and hidden flags for current photos", () => {
    const items = adminListingMediaItemsFromPayload({
      profileImageUrl: PROFILE,
      portfolioFileNames: [PHOTO_A, PHOTO_B],
      listingDisplayOrder: [PHOTO_B, PROFILE],
      listingHiddenImageUrls: [PROFILE],
    });

    expect(items).toEqual([
      { url: PHOTO_B, hidden: false, label: "Portfolio 1" },
      { url: PROFILE, hidden: true, label: "Profile photo" },
      { url: PHOTO_A, hidden: false, label: "Portfolio 3" },
    ]);
  });
});
