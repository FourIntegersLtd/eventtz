"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSettingsView } from "@/features/admin/settings/AdminSettingsView";

export default function AdminSettingsPage() {
  return (
    <AdminConsolePage title="Settings">
      <AdminSettingsView />
    </AdminConsolePage>
  );
}
