"use client";

import { DashboardView } from "@/domains/vendor-dashboard/DashboardView";

/** `/vendor/dashboard` — the vendor's home screen. Auth/shell wiring is in the portal layout. */
export default function VendorDashboardPage() {
  return <DashboardView />;
}
