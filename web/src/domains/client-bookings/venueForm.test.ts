import test from "node:test";
import assert from "node:assert/strict";
import { parseVenueForm, toUpdateVenueBody } from "@/domains/client-bookings/venueForm";

test("a blank address carries the venue-prompt error", () => {
  const result = parseVenueForm({ eventAddress: "" });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.eventAddress, "Enter a full event address.");
});

test("an address under 3 characters is rejected", () => {
  const result = parseVenueForm({ eventAddress: "ab" });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.eventAddress, "Enter a full event address.");
});

test("an address over 500 characters is rejected", () => {
  const result = parseVenueForm({ eventAddress: "x".repeat(501) });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.eventAddress, "Address is too long.");
});

test("a valid venue trims the address and builds the venue body", () => {
  const result = parseVenueForm({ eventAddress: "  12 High Street  " });
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail();
  assert.equal(result.data.eventAddress, "12 High Street");
  assert.deepEqual(toUpdateVenueBody(result.data), { event_address: "12 High Street" });
});

test("the pay-page venue example is accepted", () => {
  const result = parseVenueForm({ eventAddress: "The Grand Hall, 12 Park Lane, London" });
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail();
  assert.equal(result.data.eventAddress.includes("Park Lane"), true);
});
