"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminTeamView } from "@/features/admin/team/AdminTeamView";

export default function AdminTeamPage() {
  return (
    <AdminConsolePage title="Admin team">
      <AdminTeamView />
    </AdminConsolePage>
  );
}
