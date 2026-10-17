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
  if (!hasBrowseGoodToKnowContent(facts)) {
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
      <div className="border-t border-neutral-100 px-5 py-4">
        <h5 className="text-[13px] font-semibold text-neutral-900">
          Cancellation policy — {facts.cancellationPolicyLabel}
        </h5>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-neutral-600">
          {facts.cancellationPolicyLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
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
