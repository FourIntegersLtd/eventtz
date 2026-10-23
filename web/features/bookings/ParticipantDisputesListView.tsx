"use client";

import { CARD_SURFACE } from "@/components/ui/tokens";
import { useServerList } from "@/lib/useServerList";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  fetchParticipantDisputesPage,
  type ParticipantDispute,
} from "@/lib/bookingDisputesApi";
import { TablePagination } from "@/components/ui/TablePagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { ParticipantDisputeStatusBadge } from "@/components/badges/ParticipantDisputeStatusBadge";
import { participantDisputeBookingLabel } from "@/lib/bookingDisputeHelpers";
import {
  enrichParticipantDisputes,
  loadParticipantBookingLookup,
  participantDisputeNeedsHydration,
} from "@/lib/participantDisputeEnrichment";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

import type { PortalRole } from "@/lib/portalRole";
import { formatDateTimeSeconds } from "@/lib/dateFormat";

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
  return "-";
}

function updatedLabel(d: ParticipantDispute): string {
  const raw = d.updated_at || d.created_at;
  return raw ? formatDateTimeSeconds(new Date(raw)) : "-";
}

export function ParticipantDisputesListView({ role, selectedId = null, onSelect }: Props) {
  const { user } = useAuth();
  const {
    items: rows,
    total,
    offset,
    limit,
    loading,
    error,
    goNext,
    goPrevious,
    reload,
  } = useServerList<ParticipantDispute, { role: PortalRole }>({
    filters: { role },
    errorMessage: "Could not load disputes.",
    fetchPage: async ({ offset: pageOffset, limit: pageLimit }) => {
      const page = await fetchParticipantDisputesPage(role, pageOffset, pageLimit);
      let list = page.disputes;
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
      return { items: list, total: page.total };
    },
  });

  useRealtimeRefresh("disputes:refresh", reload, [role, reload]);

  // Only the first load blanks the screen; paging and realtime refreshes keep the rows in place.
  if (loading && rows.length === 0 && !error) {
    return <LoadingState label="Loading disputes…" variant="centered" branded className="py-12" />;
  }

  return (
    <div className="space-y-4">
      {error ? <LottieFailureInline message={error} /> : null}

      <div className={`overflow-hidden ${CARD_SURFACE}`}>
        {rows.length === 0 ? (
          <EmptyState className="border-0 py-14" title="No disputes yet." lottie="allCaughtUp" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((d) => {
              const sel = selectedId === d.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(d.id)}
                    aria-current={sel}
                    className={`relative w-full px-5 py-6 text-left transition duration-150 ease-out sm:px-6 sm:py-7 ${
                      sel ? "bg-primary/[0.05]" : "hover:bg-surface-3"
                    }`}
                  >
                    {sel ? (
                      <span
                        className="absolute inset-y-4 left-0 w-[3px] rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}

                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-ink line-clamp-2">
                        {participantDisputeBookingLabel(d)}
                      </p>
                      <span className="ez-list-row__status shrink-0">
                        <ParticipantDisputeStatusBadge status={d.status} />
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <p className="line-clamp-2 text-sm text-ink-2">{d.summary}</p>
                      <p className="text-sm text-ink-3">Opened by {openedByLabel(d)}</p>
                      <p className="text-sm text-ink-3">{updatedLabel(d)}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TablePagination
        offset={offset}
        limit={limit}
        total={total}
        loading={loading}
        onPrevious={goPrevious}
        onNext={goNext}
      />
    </div>
  );
}
