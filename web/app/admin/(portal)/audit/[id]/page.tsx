"use client";

import { useParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminAuditDetailView } from "@/features/admin/audit/AdminAuditDetailView";

export default function AdminAuditDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  return (
    <AdminConsolePage title="Activity detail">
      {id ? (
        <AdminAuditDetailView entryId={id} />
      ) : (
        <p className="text-sm text-neutral-600">Invalid id.</p>
      )}
    </AdminConsolePage>
  );
}
