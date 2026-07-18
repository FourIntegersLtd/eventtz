"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";
import { Drawer } from "@/components/ui/Drawer";
import { BackLink } from "@/components/ui/BackLink";
import { ParticipantDisputeDetailPanel } from "@/features/disputes/ParticipantDisputeDetailPanel";
import { ParticipantDisputesListView } from "@/features/bookings/ParticipantDisputesListView";
import {
  fetchClientDispute,
  fetchVendorDispute,
  type ParticipantDispute,
} from "@/lib/bookingDisputesApi";
import { participantDisputeBookingLabel } from "@/lib/bookingDisputeHelpers";
import {
  enrichParticipantDispute,
  loadParticipantBookingLookup,
  participantDisputeNeedsHydration,
} from "@/lib/participantDisputeEnrichment";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

type Props = {
  role: PortalRole;
  selectedDisputeId?: string | null;
};

export function ParticipantDisputesPortalView({ role, selectedDisputeId = null }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const disputesBase = portalRoute(role, "disputes");

  const [dispute, setDispute] = useState<ParticipantDispute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!selectedDisputeId) {
      setDispute(null);
      setDetailError(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const row =
        role === "client"
          ? await fetchClientDispute(selectedDisputeId)
          : await fetchVendorDispute(selectedDisputeId);

      let hydrated = row;
      if (user?.id && participantDisputeNeedsHydration(row)) {
        try {
          const bookings = await loadParticipantBookingLookup(role);
          const booking = bookings.get(row.booking_request_id);
          if (booking) {
            hydrated = enrichParticipantDispute(row, booking, {
              role,
              userId: user.id,
              email: user.email,
            });
          }
        } catch {
          // Keep API payload when booking lookup fails.
        }
      }

      setDispute(hydrated);
    } catch {
      setDispute(null);
      setDetailError("Could not load this dispute.");
    } finally {
      setDetailLoading(false);
    }
  }, [role, selectedDisputeId, user?.email, user?.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useRealtimeRefresh("disputes:refresh", () => void loadDetail(), [loadDetail]);

  return (
    <>
      <ParticipantDisputesListView
        role={role}
        selectedId={selectedDisputeId}
        onSelect={(id) => router.push(`${disputesBase}/${encodeURIComponent(id)}`)}
      />

      <Drawer
        isOpen={Boolean(selectedDisputeId)}
        onClose={() => router.push(disputesBase)}
        title="Dispute"
        subtitle={dispute ? participantDisputeBookingLabel(dispute) : undefined}
        widthClassName="max-w-xl"
      >
        <BackLink
          href={disputesBase}
          label="Back to disputes"
          tone="muted"
          className="mb-4"
        />
        <ParticipantDisputeDetailPanel
          role={role}
          dispute={dispute}
          loading={detailLoading}
          error={detailError}
        />
      </Drawer>
    </>
  );
}
