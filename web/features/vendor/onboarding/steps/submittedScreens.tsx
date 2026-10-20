"use client";

import Link from "next/link";
import {
  BookOpen,
  Check,
  Clock,
  Eye,
  Pencil,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { ONBOARDING_STEP } from "../onboardingProgress";

/** Inline svgs sit on the text baseline in the artboard; Tailwind preflight would make them block. */
const INLINE_ICON_STYLE = { display: "inline", verticalAlign: "baseline" } as const;

type SubmittedPendingScreenProps = {
  firstName: string;
  email: string;
  onViewProfileReview: () => void;
  onEditAnswers: () => void;
};

/**
 * Post-submit pending review (design V09): timeline of what happens next and links while
 * the vendor waits. Shown at wizard step 10 when the profile is submitted and still pending.
 */
export function SubmittedPendingScreen({
  firstName,
  email,
  onViewProfileReview,
  onEditAnswers,
}: SubmittedPendingScreenProps) {
  const greetingName = firstName.trim() || "there";
  return (
    <div className="ez-stack ez-stack--lg">
      <div className="ez-pagehead">
        <div className="ez-pagehead__text">
          <span className="ez-eyebrow">Vendor profile</span>
          <h1 className="ez-h1">Thanks, {greetingName}. We have your profile</h1>
          <p className="ez-body">Our team reviews every new business before it appears to clients.</p>
        </div>
      </div>
      <div className="ez-banner ez-banner--warning">
        <Clock size={20} strokeWidth={1.75} aria-hidden />
        <div className="ez-banner__body">
          <div className="ez-banner__title">In review</div>
          <p className="ez-small" style={{ color: "inherit" }}>
            Most reviews finish within 2 working days. We will email {email.trim() || "you"} the moment
            there is news.
          </p>
        </div>
      </div>
      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">What happens next</span>
            </div>
            <div className="ez-card__body">
              <div className="ez-timeline">
                <div className="ez-tl-item ez-tl-item--done">
                  <span className="ez-tl-dot">
                    <Check size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                  </span>
                  <div className="ez-tl-body">
                    <span className="ez-tl-title">Profile submitted</span>
                    <span className="ez-small" data-design-dynamic="submitted-at">
                      Mon 19 Oct 2026
                    </span>
                  </div>
                </div>
                <div className="ez-tl-item ez-tl-item--current">
                  <span className="ez-tl-dot" />
                  <div className="ez-tl-body">
                    <span className="ez-tl-title">Review by the Eventtz team</span>
                    <span className="ez-small">We check your details, prices and photos.</span>
                  </div>
                </div>
                <div className="ez-tl-item ez-tl-item--todo">
                  <span className="ez-tl-dot" />
                  <div className="ez-tl-body">
                    <span className="ez-tl-title">You are approved and go live</span>
                    <span className="ez-small">Clients can find and enquire with you.</span>
                  </div>
                </div>
                <div className="ez-tl-item ez-tl-item--todo">
                  <span className="ez-tl-dot" />
                  <div className="ez-tl-body">
                    <span className="ez-tl-title">Set up payouts</span>
                    <span className="ez-small">Link your bank through Stripe to accept paid bookings.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">
          <div className="ez-stack ez-stack--lg">
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">While you wait</span>
              </div>
              <div className="ez-card__body">
                <div className="ez-stack ez-stack--sm">
                  <button
                    type="button"
                    className="ez-btn ez-btn--secondary ez-btn--block"
                    onClick={onViewProfileReview}
                  >
                    <Eye size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                    View my profile
                  </button>
                  <button type="button" className="ez-btn ez-btn--ghost ez-btn--block" onClick={onEditAnswers}>
                    <Pencil size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                    Edit my answers
                  </button>
                  <Link className="ez-btn ez-btn--ghost ez-btn--block" href="/vendor/help">
                    <BookOpen size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                    Read the vendor guide
                  </Link>
                </div>
              </div>
            </div>
            <div className="ez-card">
              <div className="ez-card__body">
                <div className="ez-hrow">
                  <Shield size={20} strokeWidth={1.75} aria-hidden />
                  <div>
                    <div className="ez-strong">Your details are private</div>
                    <div className="ez-caption">Only your public profile is shown to clients.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ReturnedForEditsScreenProps = {
  reviewedAtLabel: string;
  onResubmit: () => void;
};

/**
 * Admin returned the profile for edits (design V10). The api stores only a timestamp, not the
 * per-section notes shown in the artboard, so the three example rows stay illustrative until
 * moderation messages are persisted on the payload.
 */
export function ReturnedForEditsScreen({ reviewedAtLabel, onResubmit }: ReturnedForEditsScreenProps) {
  const issueRows = [
    {
      title: "Portfolio",
      hint: "Two photos are blurry. Please add at least 5 clear photos of your own work.",
    },
    {
      title: "Pricing",
      hint: "The Naming ceremony platter needs a clear list of what is included.",
    },
    {
      title: "Business description",
      hint: "Please remove the phone number from your description. Clients see it after booking.",
    },
  ];
  return (
    <div className="ez-stack ez-stack--lg">
      <div className="ez-pagehead">
        <div className="ez-pagehead__text">
          <span className="ez-eyebrow">Vendor profile</span>
          <h1 className="ez-h1">A few changes before we can approve you</h1>
          <p className="ez-body">Nothing is lost. Update the items below and resubmit.</p>
        </div>
      </div>
      <div className="ez-banner ez-banner--warning">
        <TriangleAlert size={20} strokeWidth={1.75} aria-hidden />
        <div className="ez-banner__body">
          <div className="ez-banner__title">Returned for edits</div>
          <p className="ez-small" style={{ color: "inherit" }} data-design-dynamic="reviewed-at">
            Reviewed {reviewedAtLabel} by the Eventtz team.
          </p>
        </div>
        <div className="ez-banner__actions">
          <button type="button" className="ez-btn ez-btn--primary" onClick={onResubmit}>
            Resubmit for review
          </button>
        </div>
      </div>
      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">What to fix</span>
            </div>
            <div className="ez-card__body">
              <div className="ez-stack">
                {issueRows.map((row) => (
                  <div className="ez-list-row" key={row.title}>
                    <span className="ez-icon-tile ez-icon-tile--warning">
                      <TriangleAlert size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                    </span>
                    <div className="ez-list-row__main">
                      <span className="ez-strong">{row.title}</span>
                      <span className="ez-small">{row.hint}</span>
                    </div>
                    <button type="button" className="ez-btn ez-btn--secondary ez-btn--sm">
                      Fix
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">
          <div className="ez-card" data-design-static="returned-help" style={{ minHeight: 220 }}>
            <div className="ez-card__body" style={{ paddingTop: 24, paddingBottom: 24 }}>
              <div className="ez-stack ez-stack--sm" style={{ gap: 12 }}>
                <span className="ez-h3">Need help?</span>
                <span className="ez-small">
                  Message us from Help and we will reply within a working day.
                </span>
                <Link
                  className="ez-btn ez-btn--ghost ez-btn--block"
                  href="/vendor/help"
                >
                  <BookOpen size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                  Open Help
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/** Opens the review step so a returned vendor can fix answers before resubmitting. */
export function openReviewForResubmit(navigateToStep: (step: number) => void): void {
  navigateToStep(ONBOARDING_STEP.review);
}
