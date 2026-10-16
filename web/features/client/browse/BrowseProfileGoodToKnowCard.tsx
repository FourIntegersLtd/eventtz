import type { BrowseVendorProfileFacts } from "./browseVendorFacts";
import { BrowseProfileCallout, BrowseProfileFactRow } from "./BrowseProfileFactRow";

type BrowseProfileGoodToKnowCardProps = {
  facts: BrowseVendorProfileFacts;
  className?: string;
};

export function BrowseProfileGoodToKnowCard({
  facts,
  className = "",
}: BrowseProfileGoodToKnowCardProps) {
  const hasContent =
    Boolean(facts.availableDays) ||
    Boolean(facts.unavailableDatesLabel) ||
    facts.foodNotes.length > 0 ||
    facts.trustBadges.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-neutral-100 bg-white ${className}`.trim()}
    >
      <div className="px-5 pt-4 pb-1">
        <h4 className="text-sm font-semibold text-neutral-900">Before you book</h4>
        <p className="mt-0.5 text-[12px] text-neutral-500">Availability and other essentials</p>
      </div>
      {facts.unavailableDatesLabel ? (
        <div className="px-5 pb-4 pt-2">
          <BrowseProfileCallout title="Not available on these dates">
            {facts.unavailableDatesLabel}
          </BrowseProfileCallout>
        </div>
      ) : null}
      <dl className="space-y-1 px-5 pb-4">
        {facts.availableDays ? (
          <BrowseProfileFactRow label="Usually available" value={facts.availableDays} />
        ) : null}
        {facts.foodNotes.map((note) => (
          <BrowseProfileFactRow
            key={note.label}
            label={note.label}
            value={note.value}
            tone={note.label === "Allergens & dietary" ? "notice" : "default"}
          />
        ))}
        {facts.trustBadges.length > 0 ? (
          <BrowseProfileFactRow
            label="On file"
            value={facts.trustBadges.join(" · ")}
            tone="positive"
          />
        ) : null}
      </dl>
    </section>
  );
}

export function hasBrowseGoodToKnowContent(facts: BrowseVendorProfileFacts): boolean {
  return (
    Boolean(facts.availableDays) ||
    Boolean(facts.unavailableDatesLabel) ||
    facts.foodNotes.length > 0 ||
    facts.trustBadges.length > 0
  );
}
