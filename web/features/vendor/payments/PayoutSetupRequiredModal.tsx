"use client";

import { ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";

type PayoutSetupRequiredModalProps = {
  isOpen: boolean;
  connecting: boolean;
  error?: string | null;
  clientName?: string | null;
  /** e.g. ``wedding`` for design V13 fixture copy. */
  eventDescriptor?: string;
  onClose: () => void;
  onCompleteSetup: () => void;
};

/**
 * Shown when a vendor tries to Accept without Stripe Connect ready.
 * Primary action launches Connect; Accept resumes automatically on return.
 */
export function PayoutSetupRequiredModal({
  isOpen,
  connecting,
  error,
  clientName,
  eventDescriptor = "event",
  onClose,
  onCompleteSetup,
}: PayoutSetupRequiredModalProps) {
  if (!isOpen) return null;

  const payoutCopy = clientName?.trim()
    ? `Link your bank through Stripe so we can pay you once ${clientName.trim()}'s ${eventDescriptor} is complete. We will bring you straight back to this request.`
    : "Link your bank through Stripe so we can pay you once the event is complete. We will bring you straight back to this request.";

  return (
    <div className="ez-scrim">
      <div className="ez-modal" role="dialog" aria-modal="true" aria-label="Payout setup required">
        <div className="ez-modal__head">
          <span className="ez-icon-tile ez-icon-tile--warning">
            <Wallet size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="ez-h2">You are one step away from accepting bookings</h2>
        </div>
        <div className="ez-modal__body ez-stack">
          <p className="ez-body">{payoutCopy}</p>
          <p className="ez-small">This usually takes 2-3 minutes.</p>
          {error ? <p className="ez-small text-danger">{error}</p> : null}
        </div>
        <div className="ez-modal__foot">
          <Button variant="ghost" onClick={onClose} disabled={connecting}>
            Not now
          </Button>
          <Button
            disabled={connecting}
            icon={<ArrowRight size={18} strokeWidth={1.75} aria-hidden />}
            onClick={onCompleteSetup}
          >
            {connecting ? "Opening Stripe…" : "Complete payout setup"}
          </Button>
        </div>
      </div>
    </div>
  );
}
