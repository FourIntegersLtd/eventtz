/**
 * "Before you book" card: availability, dietary notes, and certificates on file.
 */
import type { BrowseVendorProfileFacts } from "./browseVendorFacts";
import { ProfileCallout, ProfileFactRow } from "./ProfileFactRow";

type GoodToKnowCardProps = {
  facts: BrowseVendorProfileFacts;
  className?: string;
};

/** True when the card would show at least one fact. */
export function hasGoodToKnowContent(facts: BrowseVendorProfileFacts): boolean {
  return (
    Boolean(facts.availableDays) ||
    Boolean(facts.unavailableDatesLabel) ||
    facts.foodNotes.length > 0 ||
    facts.trustBadges.length > 0
  );
}

/** Availability and other essentials, shown under the pricing sidebar. */
export function GoodToKnowCard({ facts, className = "" }: GoodToKnowCardProps) {
  if (!hasGoodToKnowContent(facts)) return null;

  return (
    <section className={`overflow-hidden rounded-2xl border border-neutral-100 bg-white ${className}`.trim()}>
      <div className="px-5 pb-1 pt-4">
        <h4 className="text-sm font-semibold text-neutral-900">Before you book</h4>
        <p className="mt-0.5 text-[12px] text-neutral-500">Availability and other essentials</p>
      </div>
      {facts.unavailableDatesLabel ? (
        <div className="px-5 pb-4 pt-2">
          <ProfileCallout title="Not available on these dates">{facts.unavailableDatesLabel}</ProfileCallout>
        </div>
      ) : null}
      <dl className="space-y-1 px-5 pb-4">
        {facts.availableDays ? (
          <ProfileFactRow label="Usually available" value={facts.availableDays} />
        ) : null}
        {facts.foodNotes.map((note) => (
          <ProfileFactRow
            key={note.label}
            label={note.label}
            value={note.value}
            tone={note.label === "Allergens & dietary" ? "notice" : "default"}
          />
        ))}
        {facts.trustBadges.length > 0 ? (
          <ProfileFactRow label="On file" value={facts.trustBadges.join(" · ")} tone="positive" />
        ) : null}
      </dl>
    </section>
  );
}
