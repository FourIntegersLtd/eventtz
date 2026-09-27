import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { syncPerUnitPackageSelection } from "./perUnitPackageSelection";
import { buildBookingLineItems, type BrowsePricingOption } from "./vendorBrowseDetailModel";

const options: BrowsePricingOption[] = [
  {
    id: "fixed-cake",
    tabLabel: "Cake",
    heading: "Wedding cake",
    priceDisplay: "200",
    compareAtDisplay: null,
    unitPriceGbp: 200,
    pricingMode: "fixed",
    unitLabel: null,
    minQuantity: 1,
    maxQuantity: null,
    priceSuffix: null,
    discountBadge: null,
    travelLine: null,
    promoLines: [],
    description: "",
    timelineLine: null,
    featureLines: [],
  },
  {
    id: "chairs",
    tabLabel: "Chairs",
    heading: "Chair hire",
    priceDisplay: "12",
    compareAtDisplay: null,
    unitPriceGbp: 12,
    pricingMode: "per_unit",
    unitLabel: "chair",
    minQuantity: 10,
    maxQuantity: 500,
    priceSuffix: "/ chair",
    discountBadge: null,
    travelLine: null,
    promoLines: [],
    description: "",
    timelineLine: null,
    featureLines: [],
  },
];

describe("syncPerUnitPackageSelection", () => {
  it("auto-selects per-unit packages when quantity meets minimum", () => {
    const next = syncPerUnitPackageSelection(options, new Set<string>(), {}, "chairs", 10);

    assert.equal(next.selectedIds.has("chairs"), true);
    const lines = buildBookingLineItems(options, [...next.selectedIds], next.quantities);
    assert.equal(lines[0]?.unitPriceGbp, 120);
    assert.equal(lines[0]?.quantity, 10);
  });

  it("deselects per-unit packages when quantity drops below minimum", () => {
    const next = syncPerUnitPackageSelection(
      options,
      new Set(["chairs"]),
      { chairs: 10 },
      "chairs",
      5,
    );

    assert.equal(next.selectedIds.has("chairs"), false);
  });

  it("leaves fixed packages unchanged when quantity updates", () => {
    const next = syncPerUnitPackageSelection(
      options,
      new Set(["fixed-cake"]),
      {},
      "fixed-cake",
      2,
    );

    assert.equal(next.selectedIds.has("fixed-cake"), true);
    assert.equal(next.quantities["fixed-cake"], 2);
  });
});
