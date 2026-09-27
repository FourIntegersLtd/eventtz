import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCommerceTab } from "@/domains/admin-commerce/commerceTab";

test("parseCommerceTab defaults to bookings", () => {
  assert.equal(parseCommerceTab(null), "bookings");
  assert.equal(parseCommerceTab("nope"), "bookings");
  assert.equal(parseCommerceTab("financials"), "financials");
});
