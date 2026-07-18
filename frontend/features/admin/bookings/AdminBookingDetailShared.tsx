"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronRight, type LucideIcon } from "lucide-react";
import { adminCard } from "@/features/admin/adminTheme";
import type { AdminBookingSupportMeta } from "@/lib/adminPlatformApi";
import { shortId } from "./adminBookingDetailUtils";

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${adminCard} p-5`}>
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-4">{children}</div>
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

export function ExpandableId({ value }: { value: unknown; label: string }) {
  const full = value != null ? String(value).trim() : "";
  const [open, setOpen] = useState(false);
  if (!full) return <span className="text-neutral-400">—</span>;
  const compact = shortId(full);
  return (
    <div className="text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-sm text-neutral-800 hover:text-primary"
        aria-expanded={open}
      >
        {open ? full : compact}
      </button>
      {!open && full.length > (compact?.length ?? 0) ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-2 text-[12px] font-medium text-primary hover:underline"
        >
          Show full
        </button>
      ) : null}
    </div>
  );
}

export function formatTs(v: unknown): React.ReactNode {
  if (v == null) return <span className="text-neutral-400">—</span>;
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
  return (
    <div className="group relative">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 hidden w-52 -translate-x-1/2 rounded-lg bg-neutral-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg group-hover:block"
      >
        {hint}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
      </div>
    </div>
  );
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
        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-neutral-50 disabled:opacity-50 ${
          action.destructive ? "hover:bg-red-50/60" : ""
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            action.destructive ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-900">
          {action.title}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
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
    <div
      className={`${adminCard} px-5 py-4 text-center ${
        hasCritical
          ? "border-red-200/90 bg-red-50/50 ring-1 ring-red-200/50"
          : "border-amber-200/90 bg-amber-50/60 ring-1 ring-amber-200/50"
      }`}
    >
      <p
        className={`flex items-center justify-center gap-2 text-sm font-semibold ${
          hasCritical ? "text-red-900" : "text-amber-900"
        }`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Needs attention
      </p>
      <ul className="mx-auto mt-3 max-w-xl space-y-1.5 text-sm text-neutral-800">
        {support.needs_attention.map((flag) => (
          <li key={flag.code}>{flag.label}</li>
        ))}
      </ul>
      {support.next_action ? (
        <p className="mt-3 text-sm text-neutral-600">
          Try next: <span className="font-medium text-neutral-900">{support.next_action}</span>
        </p>
      ) : null}
      {openDispute ? (
        <Link
          href={`/admin/commerce?tab=disputes&dispute=${openDispute.id}`}
          className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
        >
          View open dispute
        </Link>
      ) : null}
    </div>
  );
}
