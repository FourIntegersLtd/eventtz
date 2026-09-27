"use client";

import { useEffect, useState } from "react";
import { AdminErrorBanner, AdminLoadingState, formatDateTime } from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminAuditLogEntry, type AdminAuditLogItem } from "@/domains/admin-audit/api";
import { formatAuditActionLabel } from "@/domains/admin-audit/auditFormatters";

/** `/admin/audit/[id]` — the full detail of one audit entry, including its raw JSON payload. */
export function AdminAuditDetailView({ entryId }: { entryId: string }) {
  const [entry, setEntry] = useState<AdminAuditLogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminAuditLogEntry(entryId)
      .then((result) => {
        if (!cancelled) setEntry(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(isPlatformError(cause) ? cause.detail : "Could not load activity entry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (loading) return <AdminLoadingState label="Loading activity entry…" />;
  if (error || !entry) return <AdminErrorBanner message={error ?? "Not found."} />;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-primary-border bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{formatDateTime(entry.created_at)}</p>
        <p className="mt-1 text-lg font-semibold text-neutral-900">{formatAuditActionLabel(entry.action)}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Admin</dt>
            <dd className="text-neutral-900">{entry.admin_email ?? "-"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Entity type</dt>
            <dd className="text-neutral-900">{entry.entity_type}</dd>
          </div>
          {entry.entity_id ? (
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Entity id</dt>
              <dd className="text-neutral-900">{entry.entity_id}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {entry.audit_event_details ? (
        <details className="rounded-2xl border border-primary-border bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Technical record</summary>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700">
            {JSON.stringify(entry.audit_event_details, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
