"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronRight, type LucideIcon } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import { Tooltip } from "@/components/ui/Tooltip";
import type { AdminBookingSupportMeta } from "@/lib/adminPlatformApi";
import { shortId } from "./adminBookingDetailUtils";
import { formatDate } from "@/lib/dateFormat";

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card as="section">
      <Card.Header>
        <h2 className="ez-h3">{title}</h2>
      </Card.Header>
      <Card.Body>{children}</Card.Body>
    </Card>
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
  if (!full) return <span className="text-ink-3">-</span>;
  const compact = maskStripeId(full) ?? shortId(full) ?? full;
  return (
    <div className="text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-sm text-ink hover:text-primary"
        aria-expanded={open}
        aria-label={open ? `Hide full ${label}` : `Show full ${label}`}
      >
        <code className="rounded-md bg-surface-3 px-2 py-0.5 text-[13px]">
          {open ? full : compact}
        </code>
      </button>
    </div>
  );
}

export function formatTs(v: unknown): React.ReactNode {
  if (v == null) return <span className="text-ink-3">-</span>;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return formatDate(d, "dateTimeMedium");
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
        className={getButtonClassName({
          variant: action.destructive ? "destructive" : "secondary",
          className: "w-full justify-start",
        })}
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
    <Banner
      tone={hasCritical ? "danger" : "warning"}
      icon={<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />}
      title="Needs attention"
    >
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
    </Banner>
  );
}
