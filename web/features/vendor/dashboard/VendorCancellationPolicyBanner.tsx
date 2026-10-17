"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

type VendorCancellationPolicyBannerProps = {
  /** `null` while unknown (profile not loaded); true once the vendor has stored a preset. */
  policyChosen: boolean | null;
  loading: boolean;
};

/**
 * Nudge an approved vendor to pick a cancellation preset. Shown until one is stored;
 * clients see the Flexible preset on their profile and at checkout meanwhile.
 */
export function VendorCancellationPolicyBanner({ policyChosen, loading }: VendorCancellationPolicyBannerProps) {
  const router = useRouter();
  if (loading || policyChosen !== false) return null;

  return (
    <div className="rounded-2xl border border-sky-200/80 bg-sky-50 px-4 py-4 shadow-sm sm:px-5">
      <h2 className="font-heading text-base font-semibold text-sky-950">You now decide your refund policy</h2>
      <p className="mt-1 text-sm leading-relaxed text-sky-900/90">
        Pick how much a client gets back if they cancel a paid booking: Flexible, Moderate or
        Strict. Whatever they don&apos;t get back is paid to you straight away. Until you pick,
        clients see Flexible.
      </p>
      <div className="mt-3">
        <Button variant="primary" size="sm" onClick={() => router.push("/vendor/profile")}>
          Pick my policy
        </Button>
      </div>
    </div>
  );
}
