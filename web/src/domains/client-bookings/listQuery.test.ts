import test from "node:test";
import assert from "node:assert/strict";
import { parseBookingsListQuery } from "@/domains/client-bookings/listQuery";

test("the list opens on the active tab, unfiltered, by default", () => {
  assert.deepEqual(parseBookingsListQuery(null, null), { tab: "active", status: undefined });
});

test("?tab=closed and ?status=pending are honoured", () => {
  assert.deepEqual(parseBookingsListQuery("closed", "pending"), { tab: "closed", status: "pending" });
});

test("unknown values are ignored", () => {
  assert.deepEqual(parseBookingsListQuery("archived", "accepted"), { tab: "active", status: undefined });
});
