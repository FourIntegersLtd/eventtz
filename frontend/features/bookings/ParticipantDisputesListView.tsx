"use client";

import { portalCard } from "@/components/portal-shell/portalTheme";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  fetchClientDisputes,
  fetchVendorDisputes,
  type ParticipantDispute,
} from "@/lib/bookingDisputesApi";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ParticipantDisputeStatusBadge } from "@/components/ui/ParticipantDisputeStatusBadge";
import { participantDisputeBookingLabel } from "@/lib/bookingDisputeHelpers";
import {
  enrichParticipantDisputes,
  loadParticipantBookingLookup,
  participantDisputeNeedsHydration,
} from "@/lib/participantDisputeEnrichment";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

import type { PortalRole } from "@/components/portal-shell/portalNav";

type Props = {
  role: PortalRole;
  selectedId?: string | null;
  onSelect: (disputeId: string) => void;
};

function openedByLabel(d: ParticipantDispute): string {
  if (d.opened_by_you) return "You";
  if (d.opened_by_display_name) return d.opened_by_display_name;
  if (d.opened_by_role === "client") return "Client";
  if (d.opened_by_role === "vendor") return d.vendor_display_name ?? "Vendor";
  return "—";
}

function updatedLabel(d: ParticipantDispute): string {
  const raw = d.updated_at || d.created_at;
  return raw ? new Date(raw).toLocaleString("en-GB") : "—";
}

export function ParticipantDisputesListView({ role, selectedId = null, onSelect }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParticipantDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      let list = role === "client" ? await fetchClientDisputes() : await fetchVendorDisputes();
      if (user?.id && list.some(participantDisputeNeedsHydration)) {
        try {
          const bookings = await loadParticipantBookingLookup(role);
          list = enrichParticipantDisputes(list, bookings, {
            role,
            userId: user.id,
            email: user.email,
          });
        } catch {
          // Keep API list when booking lookup fails.
        }
      }
      setRows(list);
    } catch {
      setError("Could not load disputes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [role, user?.email, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh("disputes:refresh", () => void load(), [role, load]);

  if (loading) {
    return <LoadingState label="Loading disputes…" variant="inline" />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className={`overflow-hidden ${portalCard}`}>
        {rows.length === 0 ? (
          <EmptyState className="border-0 py-14" title="No disputes yet." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((d) => {
              const sel = selectedId === d.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(d.id)}
                    aria-current={sel}
                    className={`relative w-full px-5 py-6 text-left transition duration-150 ease-out sm:px-6 sm:py-7 ${
                      sel ? "bg-primary/[0.05]" : "hover:bg-neutral-50/90"
                    }`}
                  >
                    {sel ? (
                      <span
                        className="absolute inset-y-4 left-0 w-[3px] rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}

                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2">
                        {participantDisputeBookingLabel(d)}
                      </p>
                      <ParticipantDisputeStatusBadge status={d.status} />
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <p className="line-clamp-2 text-sm text-neutral-600">{d.summary}</p>
                      <p className="text-sm text-neutral-500">Opened by {openedByLabel(d)}</p>
                      <p className="text-sm text-neutral-500">{updatedLabel(d)}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
