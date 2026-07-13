"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { fetchAdminAuditLogEntry, type AdminAuditLogItem } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminCard } from "@/features/admin/adminTheme";
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

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${adminCard} p-5`}>
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

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
      <nav className="text-sm text-neutral-600">
        <Link href="/admin/audit" className="text-primary hover:underline">
          Activity log
        </Link>
        <span className="mx-2 text-neutral-400">/</span>
        <span className="text-neutral-900">{formatAuditActionLabel(entry.action)}</span>
      </nav>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailSection title="Overview">
          <dl className="space-y-4">
            <Field label="When" value={formatAuditWhen(entry.created_at)} />
            <Field label="Action" value={formatAuditActionLabel(entry.action)} />
            <Field
              label="Admin"
              value={entry.admin_email ?? entry.admin_user_id ?? "—"}
            />
          </dl>
        </DetailSection>

        <DetailSection title="Related record">
          <dl className="space-y-4">
            <Field
              label="Type"
              value={<AuditEntityBadge label={entityLabel} entityType={entry.entity_type} />}
            />
            <Field
              label="Reference"
              value={
                entry.entity_id ? (
                  entityHref ? (
                    <Link href={entityHref} className="font-medium text-primary hover:underline">
                      Open {entityLabel.toLowerCase()}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{entry.entity_id}</span>
                  )
                ) : (
                  "—"
                )
              }
            />
          </dl>
        </DetailSection>
      </div>

      {summary ? (
        <DetailSection title="Summary">
          <p className="text-sm leading-relaxed text-neutral-700">{summary}</p>
        </DetailSection>
      ) : null}

      {hasTechnicalPayload(entry) ? (
        <DetailSection title="Technical record">
          <pre className="max-h-96 overflow-auto rounded-lg border border-neutral-100 bg-neutral-50 p-4 font-mono text-xs text-neutral-700">
            {JSON.stringify(entry.payload, null, 2)}
          </pre>
        </DetailSection>
      ) : null}
    </div>
  );
}
