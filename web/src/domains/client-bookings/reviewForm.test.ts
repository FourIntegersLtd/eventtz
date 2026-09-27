import test from "node:test";
import assert from "node:assert/strict";
import { parseReviewForm, toPostReviewBody, parseDeepLinkRating } from "@/domains/client-bookings/reviewForm";

test("a zero rating carries the star-prompt error", () => {
  const result = parseReviewForm({ rating: 0, body: "This is a thoroughly good experience" });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.rating, "Tap a star to rate your experience.");
});

test("a body under 10 characters is rejected", () => {
  const result = parseReviewForm({ rating: 4, body: "123456789" });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.body, "Please enter at least 10 characters.");
});

test("a body over 4000 characters is rejected", () => {
  const result = parseReviewForm({ rating: 4, body: "x".repeat(4001) });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.body, "Review is too long.");
});

test("a valid review builds the request body, defaulting image_urls to empty", () => {
  const result = parseReviewForm({ rating: 4, body: "Great service all round" });
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail();
  assert.deepEqual(toPostReviewBody(result.data), { rating: 4, body: "Great service all round", image_urls: [] });
});

test("a valid review passes image_urls through", () => {
  const result = parseReviewForm({
    rating: 5,
    body: "The food was incredible from start to finish",
    image_urls: ["https://example.com/a.jpg"],
  });
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail();
  assert.deepEqual(toPostReviewBody(result.data), {
    rating: 5,
    body: "The food was incredible from start to finish",
    image_urls: ["https://example.com/a.jpg"],
  });
});

test("parseDeepLinkRating accepts 1–5 and rejects anything else", () => {
  assert.equal(parseDeepLinkRating("4"), 4);
  assert.equal(parseDeepLinkRating("1"), 1);
  assert.equal(parseDeepLinkRating("0"), undefined);
  assert.equal(parseDeepLinkRating("6"), undefined);
  assert.equal(parseDeepLinkRating("abc"), undefined);
  assert.equal(parseDeepLinkRating(null), undefined);
});
