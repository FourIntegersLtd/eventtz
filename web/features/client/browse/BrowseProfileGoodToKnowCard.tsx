import { BadgeCheck, CalendarDays, CheckCircle2, RotateCcw, UtensilsCrossed } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { CANCELLATION_POLICY_GUARANTEES } from "@/features/bookings/cancellationPolicyCopy";

import type { BrowseVendorProfileFacts } from "./browseVendorFacts";
import { BrowseProfileCallout, BrowseProfileFactRow } from "./BrowseProfileFactRow";

type BrowseProfileGoodToKnowCardProps = {
  facts: BrowseVendorProfileFacts;
  className?: string;
};

type SectionProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  /** Short badge beside the title, e.g. the preset name. */
  badge?: string;
  children: ReactNode;
};

/** One titled block of the card: icon + heading, then its content. Sections are divided by a rule. */
function Section({ icon: Icon, title, badge, children }: SectionProps) {
  return (
    <section className="px-5 py-4">
      <h5 className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {title}
        {badge ? (
          <span className="ml-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[12px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200/70">
            {badge}
          </span>
        ) : null}
      </h5>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Refund tiers as a two-column table so the timing and the amount can be scanned separately. */
function RefundTierTable({ tiers }: { tiers: BrowseVendorProfileFacts["cancellationPolicyTiers"] }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          <th scope="col" className="pb-1.5 font-medium">
            If you cancel
          </th>
          <th scope="col" className="pb-1.5 text-right font-medium">
            You get back
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {tiers.map((tier) => (
          <tr key={tier.window}>
            <td className="py-2 pr-3 text-neutral-700">{tier.window}</td>
            <td
              className={`py-2 text-right font-semibold ${
                tier.refund === "No refund" ? "text-neutral-500" : "text-neutral-900"
              }`}
            >
              {tier.refund}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BrowseProfileGoodToKnowCard({
  facts,
  className = "",
}: BrowseProfileGoodToKnowCardProps) {
  if (!hasBrowseGoodToKnowContent(facts)) {
    return null;
  }

  const hasAvailability = Boolean(facts.availableDays) || Boolean(facts.unavailableDatesLabel);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-neutral-100 bg-white ${className}`.trim()}
    >
      <div className="border-b border-neutral-100 px-5 pt-4 pb-3">
        <h4 className="text-sm font-semibold text-neutral-900">Before you book</h4>
        <p className="mt-0.5 text-[12px] text-neutral-500">Availability, dietary notes and refunds</p>
      </div>

      <div className="divide-y divide-neutral-100">
        {hasAvailability ? (
          <Section icon={CalendarDays} title="Availability">
            <div className="space-y-3">
              {facts.availableDays ? (
                <p className="text-sm text-neutral-800">
                  <span className="text-neutral-500">Usually available on </span>
                  <span className="font-medium">{facts.availableDays}</span>
                </p>
              ) : null}
              {facts.unavailableDatesLabel ? (
                <BrowseProfileCallout title="Not available on these dates">
                  {facts.unavailableDatesLabel}
                </BrowseProfileCallout>
              ) : null}
            </div>
          </Section>
        ) : null}

        {facts.foodNotes.length > 0 ? (
          <Section icon={UtensilsCrossed} title="Food and dietary">
            <dl className="space-y-1">
              {facts.foodNotes.map((note) => (
                <BrowseProfileFactRow
                  key={note.label}
                  label={note.label}
                  value={note.value}
                  tone={note.label === "Allergens & dietary" ? "notice" : "default"}
                />
              ))}
            </dl>
          </Section>
        ) : null}

        {facts.trustBadges.length > 0 ? (
          <Section icon={BadgeCheck} title="On file">
            <ul className="flex flex-wrap gap-2">
              {facts.trustBadges.map((badge) => (
                <li
                  key={badge}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-900 ring-1 ring-inset ring-emerald-200/60"
                >
                  {badge}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section icon={RotateCcw} title="Cancellation policy" badge={facts.cancellationPolicyLabel}>
          <p className="mb-3 text-[12px] text-neutral-500">
            How much of the vendor&apos;s price comes back if you cancel after paying.
          </p>
          <RefundTierTable tiers={facts.cancellationPolicyTiers} />
          <ul className="mt-4 space-y-2.5 border-t border-neutral-100 pt-3">
            {CANCELLATION_POLICY_GUARANTEES.map((guarantee) => (
              <li key={guarantee.title} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <div className="text-[13px] leading-snug">
                  <p className="font-medium text-neutral-900">{guarantee.title}</p>
                  <p className="mt-0.5 text-neutral-600">{guarantee.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

/** Always true: every vendor shows a cancellation policy (Flexible when unset). */
export function hasBrowseGoodToKnowContent(facts: BrowseVendorProfileFacts): boolean {
  return (
    facts.cancellationPolicyLines.length > 0 ||
    Boolean(facts.availableDays) ||
    Boolean(facts.unavailableDatesLabel) ||
    facts.foodNotes.length > 0 ||
    facts.trustBadges.length > 0
  );
}
