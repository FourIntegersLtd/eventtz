"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminMessagesPageContent } from "@/features/admin/messages/AdminMessagesPageContent";

export default function AdminMessagesPage() {
  return (
    <AdminConsolePage title="Messages">
      <AdminMessagesPageContent />
    </AdminConsolePage>
  );
}
