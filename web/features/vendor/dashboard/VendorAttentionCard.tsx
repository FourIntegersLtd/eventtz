"use client";

import { Landmark, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/Button";

type VendorAttentionCardProps = {
  /** `null` while unknown; false once we know Stripe payouts are not set up. */
  payoutsReady: boolean | null;
  /** `null` while unknown; false once we know no cancellation preset is stored. */
  policyChosen: boolean | null;
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
};

type AttentionItem = {
  key: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Tailwind classes for the icon badge: amber for blocking items, sky for optional ones. */
  badgeClassName: string;
  title: string;
  detail: string;
  action: ReactNode;
};

/**
 * One card listing everything the vendor still has to do, one row per item, so several
 * prompts never stack as separate coloured boxes. Hidden when there is nothing to do.
 */
export function VendorAttentionCard({
  payoutsReady,
  policyChosen,
  loading,
  connecting,
  onConnect,
}: VendorAttentionCardProps) {
  const router = useRouter();
  if (loading) return null;

  const items: AttentionItem[] = [];
  if (payoutsReady === false) {
    items.push({
      key: "payouts",
      icon: Landmark,
      badgeClassName: "bg-amber-100 text-amber-800",
      title: "Your profile is hidden from clients",
      detail:
        "Connect payouts to appear in search and accept bookings. Clients can't find or contact you until your payout details are verified.",
      action: (
        <Button variant="primary" size="sm" loading={connecting} onClick={onConnect}>
          {connecting ? "Opening Stripe…" : "Connect payouts"}
        </Button>
      ),
    });
  }
  if (policyChosen === false) {
    items.push({
      key: "refund-policy",
      icon: RotateCcw,
      badgeClassName: "bg-sky-100 text-sky-800",
      title: "Pick your refund policy",
      detail:
        "Choose Flexible, Moderate or Strict for what a client gets back if they cancel a paid booking. Until you pick, clients see Flexible.",
      action: (
        <Button variant="secondary" size="sm" onClick={() => router.push("/vendor/profile")}>
          Pick my policy
        </Button>
      ),
    });
  }
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="vendor-attention-heading"
      className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 sm:px-5">
        <h2 id="vendor-attention-heading" className="font-heading text-base font-semibold text-neutral-900">
          Needs your attention
        </h2>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
          {items.length === 1 ? "1 item" : `${items.length} items`}
        </span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {items.map(({ key, icon: Icon, badgeClassName, title, detail, action }) => (
          <li
            key={key}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badgeClassName}`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">{title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-600">{detail}</p>
            </div>
            <div className="shrink-0 sm:pl-2">{action}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
