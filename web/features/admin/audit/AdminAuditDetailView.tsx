"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
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
          <Card as="section" className="overflow-hidden">
            <Card.Header>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="ez-h3">{formatAuditActionLabel(entry.action)}</h1>
                <AuditBadge
                  label={getAuditCategoryMeta(entry.action).label}
                  badgeClassName={getAuditCategoryMeta(entry.action).badgeClassName}
                />
              </div>
              <p className="ez-small">{formatAuditWhen(entry.created_at)}</p>
            </Card.Header>
            <Card.Body>
              {summary ? (
                <p className="text-sm leading-relaxed text-ink">{summary}</p>
              ) : (
                <p className="text-sm text-ink-3">No summary for this entry.</p>
              )}
              {hasTechnicalPayload(entry) ? (
                <details className="group mt-4">
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
                    Before and after (technical record)
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-xs text-ink-2">
                    {JSON.stringify(entry.audit_event_details, null, 2)}
                  </pre>
                </details>
              ) : null}
            </Card.Body>
          </Card>
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <Card as="section" className="overflow-hidden">
            <Card.Header>
              <h2 className="ez-h3">What happened</h2>
            </Card.Header>
            <dl className="divide-y divide-line">
              <div className="px-5 py-4">
                <dt className="text-[13px] text-ink-3">Admin</dt>
                <dd className="mt-0.5 text-sm font-medium text-ink">
                  {entry.admin_email ?? entry.admin_user_id ?? "-"}
                </dd>
              </div>
              <div className="px-5 py-4">
                <dt className="text-[13px] text-ink-3">Related to</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <AuditEntityBadge label={entityLabel} entityType={entry.entity_type} />
                  {entry.entity_id ? (
                    entityHref ? (
                      <Link href={entityHref} className="text-sm font-medium text-primary hover:underline">
                        Open {entityLabel.toLowerCase()}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-ink-2">{entry.entity_id}</span>
                    )
                  ) : null}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
