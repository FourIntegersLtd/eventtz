"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  fetchClientDisputes,
  fetchVendorDisputes,
  type ParticipantDispute,
} from "@/lib/bookingDisputesApi";
import { participantDisputeStatusLabel } from "@/lib/bookingDisputeHelpers";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

type Props = {
  role: "client" | "vendor";
};

export function ParticipantDisputesListView({ role }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ParticipantDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const base = role === "client" ? "/client/bookings" : "/vendor/bookings";

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = role === "client" ? await fetchClientDisputes() : await fetchVendorDisputes();
      setRows(list);
    } catch {
      setError("Could not load disputes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh("disputes:refresh", () => void load(), [role, load]);

  if (loading) {
    return <p className="text-sm text-neutral-600">Loading disputes…</p>;
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
                <th className="px-5 py-3">Summary</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((d) => {
                const href = `${base}/${encodeURIComponent(d.booking_request_id)}`;
                return (
                  <tr
                    key={d.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(href)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(href);
                      }
                    }}
                    className="cursor-pointer transition hover:bg-neutral-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-neutral-600">
                      {d.updated_at
                        ? new Date(d.updated_at).toLocaleString("en-GB")
                        : d.created_at
                          ? new Date(d.created_at).toLocaleString("en-GB")
                          : "—"}
                    </td>
                    <td className="max-w-md px-5 py-4 text-neutral-800">
                      <span className="line-clamp-2">{d.summary}</span>
                      {d.resolution_note ? (
                        <span className="mt-1 block text-xs text-neutral-500">
                          {d.status === "resolved" || d.status === "closed" ? "Outcome" : "Update"}:{" "}
                          {d.resolution_note}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-neutral-900">
                      {participantDisputeStatusLabel(d.status)}
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
