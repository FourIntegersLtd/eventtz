"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminEmailTestingView } from "@/features/admin/email/AdminEmailTestingView";

export default function AdminEmailTestingPage() {
  return (
    <AdminConsolePage title="Email testing">
      <AdminEmailTestingView />
    </AdminConsolePage>
  );
}
