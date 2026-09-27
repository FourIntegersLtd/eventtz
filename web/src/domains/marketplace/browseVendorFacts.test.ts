import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBrowseVendorProfileFacts, payloadStringField } from "./browseVendorFacts";

describe("browseVendorFacts", () => {
  it("builds location, food notes, blocked dates and http video links", () => {
    const facts = buildBrowseVendorProfileFacts({
      businessName: "  Ada's Kitchen  ",
      baseCity: "Leeds",
      region: "West Yorkshire",
      isHalal: true,
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      blockedDates: ["2026-09-20"],
      travelRadius: "under_50",
      deliveryModes: ["travel_to_client"],
      portfolioVideoNamePersisted: "https://example.com/reel.mp4",
      portfolioVideoNamesPersisted: ["not-a-url", "https://example.com/other.mp4"],
      foodHygieneCertNamePersisted: "cert.pdf",
    });

    assert.equal(payloadStringField({ businessName: "Ada" }, "businessName"), "Ada");
    assert.equal(facts.locationLine, "Leeds, West Yorkshire");
    assert.equal(facts.availableDays, "Every day");
    assert.equal(facts.travelRadiusLabel, "Under 50 miles");
    assert.deepEqual(facts.howTheyWork, ["Travels to you"]);
    assert.deepEqual(facts.foodNotes, [{ label: "Halal", value: "Yes" }]);
    assert.deepEqual(facts.trustBadges, ["Food hygiene certificate on file"]);
    assert.deepEqual(facts.portfolioVideoUrls, [
      "https://example.com/reel.mp4",
      "https://example.com/other.mp4",
    ]);
    assert.match(facts.unavailableDatesLabel ?? "", /20 Sept 2026/);
  });
});
