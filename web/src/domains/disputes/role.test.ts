import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingHref,
  counterpartyFieldLabel,
  counterpartyName,
  disputeDetailHref,
  disputeResourcePath,
  disputesCollectionPath,
  disputesListHref,
} from "@/domains/disputes/role";

test("disputesCollectionPath picks the client or vendor list endpoint", () => {
  assert.equal(disputesCollectionPath("client"), "/api/v1/client/disputes");
  assert.equal(disputesCollectionPath("vendor"), "/api/v1/vendor/disputes");
});

test("disputeResourcePath encodes the id on both portals", () => {
  assert.equal(disputeResourcePath("client", "a/b"), "/api/v1/client/disputes/a%2Fb");
  assert.equal(disputeResourcePath("vendor", "a/b"), "/api/v1/vendor/disputes/a%2Fb");
});

test("portal links stay on the role's own disputes and bookings routes", () => {
  assert.equal(disputesListHref("client"), "/client/disputes");
  assert.equal(disputesListHref("vendor"), "/vendor/disputes");
  assert.equal(disputeDetailHref("client", "d1"), "/client/disputes/d1");
  assert.equal(disputeDetailHref("vendor", "d1"), "/vendor/disputes/d1");
  assert.equal(bookingHref("client", "b1"), "/client/bookings/b1");
  assert.equal(bookingHref("vendor", "b1"), "/vendor/bookings/b1");
});

test("counterpartyFieldLabel names the other party", () => {
  assert.equal(counterpartyFieldLabel("client"), "Vendor");
  assert.equal(counterpartyFieldLabel("vendor"), "Client");
});

test("counterpartyName reads the role's field and falls back to a dash", () => {
  assert.equal(
    counterpartyName("client", { vendor_display_name: "Ada Catering", client_label: "Bob" }),
    "Ada Catering",
  );
  assert.equal(
    counterpartyName("vendor", { vendor_display_name: "Ada Catering", client_label: "Bob" }),
    "Bob",
  );
  assert.equal(counterpartyName("client", { vendor_display_name: "  ", client_label: "Bob" }), "-");
  assert.equal(counterpartyName("vendor", { vendor_display_name: "Ada", client_label: null }), "-");
});
