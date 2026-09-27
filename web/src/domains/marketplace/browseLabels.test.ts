import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  displayEventTypes,
  displayServicesOffered,
  vendorBrowseCategoryLabel,
} from "./browseLabels";

describe("browseLabels", () => {
  it("collapses all event types to one label and maps the naming-ceremony alias", () => {
    assert.deepEqual(displayEventTypes(["all", "weddings"]), ["All of the Above"]);
    assert.deepEqual(displayEventTypes(["naming_ceremony", "weddings"]), [
      "Naming Ceremonies",
      "Weddings",
    ]);
    assert.deepEqual(displayEventTypes([]), []);
  });

  it("labels known services and humanises an unknown key", () => {
    assert.deepEqual(displayServicesOffered(["photography", "cake_table"]), [
      "Photography",
      "Cake Table",
    ]);
  });

  it("uses the breadcrumb plural for photographers", () => {
    assert.equal(vendorBrowseCategoryLabel("photography"), "Photographers");
    assert.equal(vendorBrowseCategoryLabel("catering"), "Catering");
    assert.equal(vendorBrowseCategoryLabel(undefined), "Vendors");
  });
});
