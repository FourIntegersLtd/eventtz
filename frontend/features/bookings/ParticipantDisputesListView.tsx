"use client";

import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  fetchClientDisputes,
  fetchVendorDisputes,
  type ParticipantDispute,
} from "@/lib/bookingDisputesApi";
import { LoadingState } from "@/components/ui/LoadingState";
import { ParticipantDisputeStatusBadge } from "@/components/ui/ParticipantDisputeStatusBadge";
import {
  participantDisputeBookingLabel,
} from "@/lib/bookingDisputeHelpers";
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-neutral-700 shadow-sm ring-1 ring-neutral-200/50">
          No disputes yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/50">
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-neutral-50/50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Booking</th>
                <th className="px-5 py-3">Opened by</th>
                <th className="px-5 py-3">Summary</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((d) => {
                const isSelected = selectedId === d.id;
                return (
                  <tr
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(d.id);
                      }
                    }}
                    className={`cursor-pointer transition hover:bg-neutral-50 ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-neutral-600">
                      {d.updated_at
                        ? new Date(d.updated_at).toLocaleString("en-GB")
                        : d.created_at
                          ? new Date(d.created_at).toLocaleString("en-GB")
                          : "—"}
                    </td>
                    <td className="max-w-[12rem] px-5 py-4 text-xs text-neutral-700">
                      <span className="line-clamp-2">{participantDisputeBookingLabel(d)}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-neutral-700">
                      {d.opened_by_you
                        ? "You"
                        : d.opened_by_display_name ??
                          (d.opened_by_role === "client"
                            ? "Client"
                            : d.opened_by_role === "vendor"
                              ? d.vendor_display_name ?? "Vendor"
                              : "—")}
                    </td>
                    <td className="max-w-md px-5 py-4 text-neutral-800">
                      <span className="line-clamp-2">{d.summary}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <ParticipantDisputeStatusBadge status={d.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-neutral-400" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
