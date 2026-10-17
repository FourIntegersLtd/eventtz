"use client";

import { Banknote, CalendarCheck, Scale, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type VendorCancellationPolicyModalProps = {
  /** `null` while unknown (profile not loaded); true once the vendor has stored a preset. */
  policyChosen: boolean | null;
  loading: boolean;
};

/** Remembered per browser tab so a vendor sees the announcement once per visit, not on every page load. */
const DISMISSED_KEY = "eventtz.vendor.cancellationPolicyModal.dismissed";

/** The three presets in the same words as the announcement email. */
const PRESETS = [
  {
    icon: CalendarCheck,
    name: "Flexible",
    terms: "Full refund up to 7 days before the event, half between 2 and 6 days before, nothing after that.",
  },
  {
    icon: Scale,
    name: "Moderate",
    terms: "Full refund up to 30 days before, half between 7 and 29 days before, nothing after that.",
  },
  {
    icon: ShieldCheck,
    name: "Strict",
    terms: "Full refund up to 90 days before, then 75%, then half, and nothing in the last 30 days.",
  },
] as const;

function wasDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Private mode or blocked storage: the modal simply shows again next load.
  }
}

/**
 * Announce to an approved vendor who has not stored a cancellation preset that they now
 * decide their own refund policy. Opens once per browser session on the dashboard; the
 * banner below it stays until a preset is stored.
 */
export function VendorCancellationPolicyModal({ policyChosen, loading }: VendorCancellationPolicyModalProps) {
  const router = useRouter();
  // Lazy initialiser: read storage once; the Modal renders nothing until mounted, so no hydration mismatch.
  const [dismissed, setDismissed] = useState(wasDismissed);
  const open = !loading && policyChosen === false && !dismissed;

  const dismiss = () => {
    rememberDismissed();
    setDismissed(true);
  };

  const goToProfile = () => {
    dismiss();
    router.push("/vendor/profile");
  };

  return (
    <Modal
      isOpen={open}
      onClose={dismiss}
      title="You now decide your refund policy"
      maxWidthClassName="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={dismiss}>
            Maybe later
          </Button>
          <Button variant="primary" onClick={goToProfile}>
            Pick my policy
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm leading-relaxed text-neutral-700">
        <p>
          Good news: you now set the rules for what happens when a client cancels a paid booking.
          Until now every cancellation meant a full refund. From today you pick one of three
          policies, and clients agree to it when they pay:
        </p>

        <ul className="space-y-4">
          {PRESETS.map(({ icon: Icon, name, terms }) => (
            <li key={name} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">{name}</p>
                <p className="mt-0.5 text-neutral-600">{terms}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">
          <Banknote className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            Whatever the client doesn&apos;t get back is yours, and we pay it into your account
            straight away. No waiting for the event date.
          </p>
        </div>

        <p className="text-xs text-neutral-500">Until you pick, clients see Flexible.</p>
      </div>
    </Modal>
  );
}
