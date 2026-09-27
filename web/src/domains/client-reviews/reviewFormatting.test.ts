import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReviewSubtitle, formatReviewTimestamp, starRating } from "@/domains/client-reviews/reviewFormatting";

describe("formatReviewSubtitle", () => {
  it("joins the event name and date with a middot", () => {
    assert.equal(formatReviewSubtitle("Wedding", "2026-09-01"), "Wedding · 2026-09-01");
  });

  it("shows just the event name when no date is set", () => {
    assert.equal(formatReviewSubtitle("Event", ""), "Event");
  });
});

describe("starRating", () => {
  it("fills five stars for a full rating", () => {
    assert.equal(starRating(5), "★★★★★");
  });

  it("shows filled then empty stars for a partial rating", () => {
    assert.equal(starRating(3), "★★★☆☆");
  });

  it("shows five empty stars for a zero rating", () => {
    assert.equal(starRating(0), "☆☆☆☆☆");
  });

  it("clamps out-of-range ratings", () => {
    assert.equal(starRating(7), "★★★★★");
    assert.equal(starRating(-2), "☆☆☆☆☆");
  });
});

describe("formatReviewTimestamp", () => {
  it("returns a dash for a missing timestamp", () => {
    assert.equal(formatReviewTimestamp(null), "-");
  });

  it("returns the raw string for an unparsable timestamp", () => {
    assert.equal(formatReviewTimestamp("not-a-date"), "not-a-date");
  });
});
