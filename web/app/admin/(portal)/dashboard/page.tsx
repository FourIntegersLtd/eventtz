"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminDashboardView } from "@/features/admin/dashboard/AdminDashboardView";

export default function AdminDashboardPage() {
  return (
    <AdminConsolePage title="Dashboard">
      <AdminDashboardView />
    </AdminConsolePage>
  );
}
