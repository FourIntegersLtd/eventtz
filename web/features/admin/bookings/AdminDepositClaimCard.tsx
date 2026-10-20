"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { depositAwardError } from "@/features/bookings/bookingTerms";
import { adminResolveDepositClaim } from "@/lib/adminBookingsApi";
import { withMutationFeedback } from "@/lib/mutationFeedback";
import { formatGbp } from "@/lib/vendorDiscountDisplay";

type Props = {
  bookingId: string;
  booking: Record<string, unknown>;
  canDecide: boolean;
  onResolved: () => void;
};

/**
 * Shows an open damage-deposit claim (amount and the vendor's note) and lets
 * staff decide how much of it the vendor is awarded (0 up to the claim).
 * Renders nothing unless a claim exists and is unresolved.
 */
export function AdminDepositClaimCard({ bookingId, booking, canDecide, onResolved }: Props) {
  const { showToast } = useToast();
  const [award, setAward] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const claimedAt = booking.deposit_claimed_at;
  const resolvedAt = booking.deposit_claim_resolved_at;
  const claim = Number(booking.deposit_claim_gbp ?? 0);
  if (!claimedAt || resolvedAt || !(claim > 0)) return null;
  const note = typeof booking.deposit_claim_note === "string" ? booking.deposit_claim_note : "";

  const decide = async () => {
    const error = depositAwardError(award, claim);
    setFormError(error);
    if (error) return;
    setBusy(true);
    const ok = await withMutationFeedback(showToast, {
      successTitle: "Deposit claim decided",
      successDescription: `Vendor awarded £${formatGbp(Number(award))}; the rest goes back to the client.`,
      errorTitle: "Couldn't decide the claim",
      run: () => adminResolveDepositClaim(bookingId, Number(award)),
    });
    setBusy(false);
    if (ok !== null) onResolved();
  };

  return (
    <section className="ez-banner ez-banner--warning">
      <div className="ez-banner__body">
        <h2 className="ez-banner__title">Deposit claim</h2>
        <p>Vendor is claiming £{formatGbp(claim)}.</p>
        {note ? <p className="whitespace-pre-wrap">{note}</p> : null}
        {canDecide ? (
          <div className="ez-stack ez-stack--sm">
            <label className="block text-sm">
              Award to vendor (£0 to £{formatGbp(claim)})
              <input
                type="text"
                inputMode="decimal"
                value={award}
                onChange={(event) => setAward(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            {formError ? <p className="text-xs">{formError}</p> : null}
            <Button variant="primary" size="md" loading={busy} onClick={() => void decide()}>
              Decide deposit claim
            </Button>
          </div>
        ) : (
          <p className="ez-small">Only super admins can decide deposit claims.</p>
        )}
      </div>
    </section>
  );
}
