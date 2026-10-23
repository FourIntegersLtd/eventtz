"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { fetchAdminAuditLogEntry, type AdminAuditLogItem } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
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
    <div className="ez-stack ez-stack--lg">
      <BackLink href="/admin/audit" label="Activity log" icon="chevron" tone="muted" />

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <section className="ez-card overflow-hidden">
            <div className="ez-card__head">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="ez-h3">{formatAuditActionLabel(entry.action)}</h1>
                <AuditBadge
                  label={getAuditCategoryMeta(entry.action).label}
                  badgeClassName={getAuditCategoryMeta(entry.action).badgeClassName}
                />
              </div>
              <p className="ez-small">{formatAuditWhen(entry.created_at)}</p>
            </div>
            <div className="ez-card__body">
              {summary ? (
                <p className="text-sm leading-relaxed text-neutral-800">{summary}</p>
              ) : (
                <p className="text-sm text-neutral-500">No summary for this entry.</p>
              )}
              {hasTechnicalPayload(entry) ? (
                <details className="group mt-4">
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
                    Before and after (technical record)
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 font-mono text-xs text-neutral-700">
                    {JSON.stringify(entry.audit_event_details, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          </section>
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <section className="ez-card overflow-hidden">
            <div className="ez-card__head">
              <h2 className="ez-h3">What happened</h2>
            </div>
            <dl className="divide-y divide-neutral-100">
              <div className="px-5 py-4">
                <dt className="text-[13px] text-neutral-500">Admin</dt>
                <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                  {entry.admin_email ?? entry.admin_user_id ?? "-"}
                </dd>
              </div>
              <div className="px-5 py-4">
                <dt className="text-[13px] text-neutral-500">Related to</dt>
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
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
