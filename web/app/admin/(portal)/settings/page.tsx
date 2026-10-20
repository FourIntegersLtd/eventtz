"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSettingsView } from "@/features/admin/settings/AdminSettingsView";
import { resolveAdminRole } from "@/lib/adminRole";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const role = resolveAdminRole(user);
  const description =
    role === "super_admin"
      ? "Platform settings · Super admin only"
      : "Your account and password.";

  return (
    <AdminConsolePage title="Settings" description={description}>
      <AdminSettingsView />
    </AdminConsolePage>
  );
}
