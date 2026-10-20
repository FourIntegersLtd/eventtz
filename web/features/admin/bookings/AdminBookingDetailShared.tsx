"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronRight, type LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import type { AdminBookingSupportMeta } from "@/lib/adminPlatformApi";
import { shortId } from "./adminBookingDetailUtils";

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ez-card">
      <div className="ez-card__head">
        <h2 className="ez-h3">{title}</h2>
      </div>
      <div className="ez-card__body">{children}</div>
    </section>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

/** Mask Stripe-style ids for support screens (full value on expand). */
export function maskStripeId(value: unknown): string | null {
  const full = value != null ? String(value).trim() : "";
  if (!full) return null;
  if (full.length <= 12) return full;
  const prefix = full.includes("_") ? `${full.split("_")[0]}_` : full.slice(0, 3);
  const tail = full.slice(-4);
  return `${prefix}••••••••${tail}`;
}

export function ExpandableId({ value, label }: { value: unknown; label: string }) {
  const full = value != null ? String(value).trim() : "";
  const [open, setOpen] = useState(false);
  if (!full) return <span className="text-neutral-400">-</span>;
  const compact = maskStripeId(full) ?? shortId(full) ?? full;
  return (
    <div className="text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-sm text-neutral-800 hover:text-primary"
        aria-expanded={open}
        aria-label={open ? `Hide full ${label}` : `Show full ${label}`}
      >
        <code
          style={{
            fontSize: "13px",
            background: "var(--ez-surface-3, #f4f2f7)",
            padding: "2px 8px",
            borderRadius: "6px",
          }}
        >
          {open ? full : compact}
        </code>
      </button>
    </div>
  );
}

export function formatTs(v: unknown): React.ReactNode {
  if (v == null) return <span className="text-neutral-400">-</span>;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export type SupportAction = {
  id: string;
  title: string;
  tooltipHint: string;
  confirmBody: string;
  successMessage: string;
  icon: LucideIcon;
  destructive?: boolean;
  run: () => Promise<unknown>;
};

export function ActionTooltip({ hint, children }: { hint: string; children: React.ReactNode }) {
  return <Tooltip hint={hint}>{children}</Tooltip>;
}

export function CompactActionRow({
  action,
  busy,
  onSelect,
}: {
  action: SupportAction;
  busy: boolean;
  onSelect: (action: SupportAction) => void;
}) {
  const Icon = action.icon;
  return (
    <ActionTooltip hint={action.tooltipHint}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSelect(action)}
        className={
          action.destructive
            ? "ez-btn ez-btn--danger-quiet w-full justify-start"
            : "ez-btn ez-btn--secondary w-full justify-start"
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{action.title}</span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden />
      </button>
    </ActionTooltip>
  );
}

export function NeedsAttentionBanner({
  support,
  openDispute,
}: {
  support: AdminBookingSupportMeta;
  openDispute: AdminBookingSupportMeta["open_dispute"];
}) {
  const hasCritical = support.needs_attention.some((f) => f.severity === "critical");
  return (
    <div className={hasCritical ? "ez-banner ez-banner--danger" : "ez-banner ez-banner--warning"}>
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <div className="ez-banner__body">
        <p className="ez-banner__title">Needs attention</p>
        <ul>
          {support.needs_attention.map((flag) => (
            <li key={flag.code}>{flag.label}</li>
          ))}
        </ul>
        {support.next_action ? <p>Try next: {support.next_action}</p> : null}
        {openDispute ? (
          <Link href={`/admin/commerce?tab=disputes&dispute=${openDispute.id}`} className="ez-link">
            View open dispute
          </Link>
        ) : null}
      </div>
    </div>
  );
}
