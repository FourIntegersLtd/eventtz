import { describe, expect, it } from "vitest";
import {
  parseVendorQueueTab,
  vendorListEmptyCopy,
  vendorQueueFilters,
} from "./adminVendorQueueStatus";

describe("vendor queue tab", () => {
  it("defaults to all vendors when the url names no known tab", () => {
    expect(parseVendorQueueTab(null)).toBe("all");
    expect(parseVendorQueueTab("")).toBe("all");
    expect(parseVendorQueueTab("nonsense")).toBe("all");
  });

  it("reads a known tab from the url", () => {
    expect(parseVendorQueueTab("pending")).toBe("pending");
    expect(parseVendorQueueTab("suspended")).toBe("suspended");
  });

  it("sends no status filters on the all tab", () => {
    expect(vendorQueueFilters("all")).toEqual({ approvalStatus: "", profileStatus: "" });
  });
});

describe("vendor list empty copy", () => {
  it("says there are no vendors when nothing narrows the list", () => {
    expect(vendorListEmptyCopy("all", "All vendors", "  ")).toEqual({ title: "No vendors yet" });
  });

  it("names the active filter", () => {
    expect(vendorListEmptyCopy("pending", "Pending review", "")).toEqual({
      title: "No vendors match your filters",
      description: "Showing: Pending review. Clear the filter to see every vendor.",
    });
  });

  it("names the search", () => {
    expect(vendorListEmptyCopy("all", "All vendors", " acme ")).toEqual({
      title: "No vendors match your filters",
      description: 'Showing: All vendors, search "acme".',
    });
  });
});
