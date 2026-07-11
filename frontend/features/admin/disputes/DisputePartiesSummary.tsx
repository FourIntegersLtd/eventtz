"use client";

import type { AdminDisputeCase } from "@/lib/adminPlatformApi";

function OpenedBadge() {
  return (
    <span className="ml-1.5 inline-flex shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
      Opened dispute
    </span>
  );
}

type PartyLineProps = {
  label: string;
  primary: string | null | undefined;
  secondary?: string | null;
  opened: boolean;
};

function PartyLine({ label, primary, secondary, opened }: PartyLineProps) {
  return (
    <div className={opened ? "font-medium text-neutral-900" : "text-neutral-700"}>
      <span className="text-neutral-500">{label}: </span>
      <span>{primary ?? "—"}</span>
      {secondary ? <span className="block text-[11px] font-normal text-neutral-500">{secondary}</span> : null}
      {opened ? <OpenedBadge /> : null}
    </div>
  );
}

export function DisputePartiesSummary({ dispute }: { dispute: AdminDisputeCase }) {
  const clientOpened = dispute.opened_by_role === "client";
  const vendorOpened = dispute.opened_by_role === "vendor";

  return (
    <div className="space-y-1.5 text-xs">
      <PartyLine
        label="Client"
        primary={dispute.client_email}
        opened={clientOpened}
      />
      <PartyLine
        label="Vendor"
        primary={dispute.vendor_display_name}
        secondary={dispute.vendor_email ?? undefined}
        opened={vendorOpened}
      />
    </div>
  );
}

export function DisputeOpenedBySummary({ dispute }: { dispute: AdminDisputeCase }) {
  if (dispute.opened_by_role === "client") {
    return (
      <div className="text-xs">
        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-sky-900">
          Client
        </span>
        <p className="mt-1 font-medium text-neutral-900">
          {dispute.opened_by_display_name ?? dispute.client_email ?? "—"}
        </p>
      </div>
    );
  }

  if (dispute.opened_by_role === "vendor") {
    return (
      <div className="text-xs">
        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-violet-900">
          Vendor
        </span>
        <p className="mt-1 font-medium text-neutral-900">
          {dispute.opened_by_display_name ?? dispute.vendor_display_name ?? "—"}
        </p>
        {dispute.vendor_email && dispute.vendor_display_name ? (
          <p className="text-[11px] text-neutral-500">{dispute.vendor_email}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="text-xs text-neutral-600">
      <span className="inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold uppercase text-neutral-700">
        Unknown party
      </span>
      <p className="mt-1">{dispute.opened_by_display_name ?? dispute.opened_by_email ?? "—"}</p>
    </div>
  );
}

export function DisputeOpenedByCallout({ dispute }: { dispute: AdminDisputeCase }) {
  const isClient = dispute.opened_by_role === "client";
  const isVendor = dispute.opened_by_role === "vendor";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        isClient
          ? "border-sky-200 bg-sky-50"
          : isVendor
            ? "border-violet-200 bg-violet-50"
            : "border-neutral-200 bg-neutral-50"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Who opened this</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">
        {isClient ? "The client" : isVendor ? "The vendor" : "A party"} on this booking
      </p>
      <p className="mt-0.5 text-sm text-neutral-800">
        {dispute.opened_by_display_name ?? dispute.opened_by_email ?? "Unknown"}
      </p>
      {isVendor && dispute.vendor_email && dispute.vendor_display_name ? (
        <p className="mt-0.5 text-xs text-neutral-600">{dispute.vendor_email}</p>
      ) : null}
      {isClient && dispute.client_email ? (
        <p className="mt-0.5 text-xs text-neutral-600">{dispute.client_email}</p>
      ) : null}
    </div>
  );
}
