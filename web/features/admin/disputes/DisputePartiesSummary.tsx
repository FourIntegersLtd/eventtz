"use client";

import type { ReactNode } from "react";
import type { AdminDisputeCase } from "@/lib/adminPlatformApi";

type PartyRowProps = {
  role: string;
  primary: string | null | undefined;
  secondary?: string | null;
  isOpener: boolean;
};

function PartyRow({ role, primary, secondary, isOpener }: PartyRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="w-12 shrink-0 pt-0.5 text-xs font-medium text-ink-3">{role}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{primary ?? "-"}</p>
        {secondary ? <p className="mt-0.5 text-xs text-ink-3">{secondary}</p> : null}
      </div>
      {isOpener ? (
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80">
          Opener
        </span>
      ) : null}
    </div>
  );
}

export function DisputePartiesPanel({
  dispute,
  actions,
}: {
  dispute: AdminDisputeCase;
  actions?: ReactNode;
}) {
  return (
    <div>
      <div className="divide-y divide-line">
        <PartyRow
          role="Client"
          primary={dispute.client_email}
          isOpener={dispute.opened_by_role === "client"}
        />
        <PartyRow
          role="Vendor"
          primary={dispute.vendor_display_name}
          secondary={dispute.vendor_email}
          isOpener={dispute.opened_by_role === "vendor"}
        />
      </div>
      {actions ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function DisputeOpenedByCompact({ dispute }: { dispute: AdminDisputeCase }) {
  const role = dispute.opened_by_role;
  const roleLabel = role === "client" ? "Client" : role === "vendor" ? "Vendor" : "Party";
  const roleClass =
    role === "client"
      ? "text-sky-700"
      : role === "vendor"
        ? "text-primary"
        : "text-ink-2";

  const name =
    role === "client"
      ? dispute.opened_by_display_name ?? dispute.client_email ?? "-"
      : role === "vendor"
        ? dispute.opened_by_display_name ?? dispute.vendor_display_name ?? "-"
        : dispute.opened_by_display_name ?? dispute.opened_by_email ?? "-";

  return (
    <p className="text-sm text-ink-2">
      <span className={`font-medium ${roleClass}`}>{roleLabel}</span>
      <span className="text-ink-3"> · </span>
      <span className="text-ink">{name}</span>
    </p>
  );
}

export function DisputePanelSection({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`.trim()}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</h3>
      {children}
    </section>
  );
}
