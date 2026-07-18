"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { fetchAdminAuditLogEntry, type AdminAuditLogItem } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import {
  auditEntityHref,
  formatAuditActionLabel,
  formatAuditEntityLabel,
  formatAuditSummary,
  formatAuditWhen,
  getAuditCategoryMeta,
  hasTechnicalPayload,
} from "./auditFormatters";
import { AuditBadge, AuditEntityBadge } from "./AuditBadges";

type Props = {
  entryId: string;
};

export function AdminAuditDetailView({ entryId }: Props) {
  const [entry, setEntry] = useState<AdminAuditLogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setEntry(await fetchAdminAuditLogEntry(entryId));
    } catch {
      setError("Could not load activity entry.");
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <AdminLoadingState label="Loading activity entry…" rows={2} />;
  }

  if (error || !entry) {
    return <AdminErrorBanner message={error ?? "Not found."} />;
  }

  const entityHref = auditEntityHref(entry);
  const entityLabel = formatAuditEntityLabel(entry.entity_type);
  const summary = formatAuditSummary(entry);

  return (
    <div className="space-y-6">
      <BackLink href="/admin/audit" label="Activity log" icon="chevron" tone="muted" />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <AuditBadge
            label={getAuditCategoryMeta(entry.action).label}
            badgeClassName={getAuditCategoryMeta(entry.action).badgeClassName}
          />
          <h1 className="font-heading text-2xl font-semibold text-neutral-900">
            {formatAuditActionLabel(entry.action)}
          </h1>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{formatAuditWhen(entry.created_at)}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <dl className="divide-y divide-neutral-100">
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="px-5 py-4 sm:border-r sm:border-neutral-100">
              <dt className="text-[13px] text-neutral-500">Admin</dt>
              <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                {entry.admin_email ?? entry.admin_user_id ?? "—"}
              </dd>
            </div>
            <div className="border-t border-neutral-100 px-5 py-4 sm:border-t-0">
              <dt className="text-[13px] text-neutral-500">Related</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <AuditEntityBadge label={entityLabel} entityType={entry.entity_type} />
                {entry.entity_id ? (
                  entityHref ? (
                    <Link href={entityHref} className="text-sm font-medium text-primary hover:underline">
                      Open {entityLabel.toLowerCase()}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-neutral-600">{entry.entity_id}</span>
                  )
                ) : null}
              </dd>
            </div>
          </div>

          {summary ? (
            <div className="px-5 py-4">
              <dt className="text-[13px] text-neutral-500">Summary</dt>
              <dd className="mt-2 text-sm leading-relaxed text-neutral-800">{summary}</dd>
            </div>
          ) : null}

          {hasTechnicalPayload(entry) ? (
            <details className="group">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
                Technical record
              </summary>
              <pre className="max-h-96 overflow-auto border-t border-neutral-100 bg-neutral-50 px-5 py-4 font-mono text-xs text-neutral-700">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            </details>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
