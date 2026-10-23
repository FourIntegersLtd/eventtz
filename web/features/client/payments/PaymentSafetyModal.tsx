"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { PAYMENT_SAFETY_COPY } from "@/features/bookings/bookingConfirmCopy";

type PaymentSafetyModalProps = {
  isOpen: boolean;
  loading?: boolean;
  /** Vendor's cancellation policy label, shown when payment is about to be made. */
  cancellationPolicyLabel?: string | null;
  cancellationPolicyLines?: string[];
  onConfirm: () => void;
  onCancel: () => void;
};

/** Last step before Stripe Checkout: explain fund protection and the 48-hour dispute window. */
export function PaymentSafetyModal({
  isOpen,
  loading = false,
  cancellationPolicyLabel,
  cancellationPolicyLines = [],
  onConfirm,
  onCancel,
}: PaymentSafetyModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) onCancel();
      }}
      title={PAYMENT_SAFETY_COPY.modalTitle}
      maxWidthClassName="max-w-md"
      zIndexClassName="z-[70]"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel}>
            {PAYMENT_SAFETY_COPY.cancelLabel}
          </Button>
          <Button variant="primary" loading={loading} onClick={onConfirm}>
            {PAYMENT_SAFETY_COPY.confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-ink-2">
        <LottieIllustration asset="paymentSecure" size="status" className="mb-1" />
        <p>{PAYMENT_SAFETY_COPY.intro}</p>
        <ul className="list-disc space-y-2 pl-5">
          {PAYMENT_SAFETY_COPY.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        {cancellationPolicyLabel ? (
          <div className="rounded-xl bg-surface-3 px-4 py-3">
            <p className="font-semibold text-ink">
              {PAYMENT_SAFETY_COPY.cancellationPolicyHeading(cancellationPolicyLabel)}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
              {cancellationPolicyLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] font-medium">{PAYMENT_SAFETY_COPY.cancellationAgreement}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
