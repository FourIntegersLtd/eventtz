import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDashboardGmvGbp } from "@/domains/admin-dashboard/dashboardTableFormat";

test("formatDashboardGmvGbp renders two decimal places", () => {
  assert.equal(formatDashboardGmvGbp(1234.5), "£1234.50");
  assert.equal(formatDashboardGmvGbp(0), "£0.00");
});
