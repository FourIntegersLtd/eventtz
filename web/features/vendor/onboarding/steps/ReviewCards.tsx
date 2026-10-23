"use client";

/**
 * The wizard review step body (design V08): one card per answered step with an Edit
 * link back to it, then a single confirmation tick.
 */
import { Fragment } from "react";
import { Check, Pencil, TriangleAlert } from "lucide-react";
import { buildReviewCards } from "../reviewSummary";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../../../../lib/vendorOnboarding/types";
import { EzCheck } from "../../../../components/ui/ez-form";

/** Inline svgs sit on the text baseline in the artboard; Tailwind preflight would make them block. */
const INLINE_ICON_STYLE = { display: "inline", verticalAlign: "baseline" } as const;

/** The summary cards and confirmation for the wizard's review step. */
export function ReviewCards({
  data,
  update,
  onNavigateToStep,
}: {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  onNavigateToStep: (step: number) => void;
}) {
  const cards = buildReviewCards(data);
  const confirmed = data.confirmTruthful && data.confirmTerms;
  return (
    <div className="ez-stack">
      {cards.map((card) => (
        <div className="ez-card" key={card.title}>
          <div className="ez-card__head">
            <div className="ez-hrow">
              <span className={`ez-icon-tile ez-icon-tile--${card.incomplete ? "warning" : "success"}`}>
                {card.incomplete ? (
                  <TriangleAlert size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                ) : (
                  <Check size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                )}
              </span>
              <span className="ez-h3">{card.title}</span>
            </div>
            <button
              type="button"
              className="ez-btn ez-btn--ghost ez-btn--sm"
              onClick={() => onNavigateToStep(card.step)}
            >
              <Pencil size={16} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
              Edit
              <span style={{ position: "absolute", left: -9999 }}> {card.title}</span>
            </button>
          </div>
          <div className="ez-card__body">
            <dl className="ez-dl">
              {card.rows.map((row) => (
                <Fragment key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </div>
      ))}
      <EzCheck
        checked={confirmed}
        onChange={(checked) => update({ confirmTruthful: checked, confirmTerms: checked })}
      >
        I confirm my details are accurate and I agree to the vendor terms.
      </EzCheck>
    </div>
  );
}
