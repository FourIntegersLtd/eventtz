"use client";

import { Banner } from "@/components/ui/Banner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  BookOpen,
  Check,
  Clock,
  Eye,
  Pencil,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { ONBOARDING_STEP } from "../../../../lib/vendorOnboarding/onboardingProgress";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";

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
      <PageHeader descriptionSize="body" eyebrow="Vendor profile" title={`Thanks, ${greetingName}. We have your profile`} description="Our team reviews every new business before it appears to clients." />
      <Banner tone="warning" icon={<Clock size={20} strokeWidth={1.75} aria-hidden />} title="In review">
        <p className="ez-small text-inherit">
          Most reviews finish within 2 working days. We will email {email.trim() || "you"} the moment
          there is news.
        </p>
      </Banner>
      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <Card>
            <Card.Header>
              <span className="ez-h3">What happens next</span>
            </Card.Header>
            <Card.Body>
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
            </Card.Body>
          </Card>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">
          <div className="ez-stack ez-stack--lg">
            <Card>
              <Card.Header>
                <span className="ez-h3">While you wait</span>
              </Card.Header>
              <Card.Body>
                <div className="ez-stack ez-stack--sm">
                  <Button
                    variant="secondary"
                    type="button"
                    block
                    onClick={onViewProfileReview}>
                    <Eye size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                    View my profile
                  </Button>
                  <Button variant="ghost" type="button" block onClick={onEditAnswers}>
                    <Pencil size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                    Edit my answers
                  </Button>
                  <ButtonLink variant="ghost" block href="/vendor/help">
                    <BookOpen size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                    Read the vendor guide
                  </ButtonLink>
                </div>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body>
                <div className="ez-hrow">
                  <Shield size={20} strokeWidth={1.75} aria-hidden />
                  <div>
                    <div className="ez-strong">Your details are private</div>
                    <div className="ez-caption">Only your public profile is shown to clients.</div>
                  </div>
                </div>
              </Card.Body>
            </Card>
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
      <PageHeader descriptionSize="body" eyebrow="Vendor profile" title="A few changes before we can approve you" description="Nothing is lost. Update the items below and resubmit." />
      <Banner
        tone="warning"
        icon={<TriangleAlert size={20} strokeWidth={1.75} aria-hidden />}
        title="Returned for edits"
        action={
          <Button type="button" onClick={onResubmit}>
            Resubmit for review
          </Button>
        }>
        <p className="ez-small text-inherit" data-design-dynamic="reviewed-at">
          Reviewed {reviewedAtLabel} by the Eventtz team.
        </p>
      </Banner>
      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <Card>
            <Card.Header>
              <span className="ez-h3">What to fix</span>
            </Card.Header>
            <Card.Body>
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
                    <Button variant="secondary" size="sm" type="button">
                      Fix
                    </Button>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">
          <Card className="min-h-[220px]" data-design-static="returned-help">
            <Card.Body className="pt-6 pb-6">
              <div className="ez-stack ez-stack--sm gap-3">
                <span className="ez-h3">Need help?</span>
                <span className="ez-small">
                  Message us from Help and we will reply within a working day.
                </span>
                <ButtonLink
                  variant="ghost"
                  block
                  href="/vendor/help">
                  <BookOpen size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON_STYLE} />
                  Open Help
                </ButtonLink>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}


/** Opens the review step so a returned vendor can fix answers before resubmitting. */
export function openReviewForResubmit(navigateToStep: (step: number) => void): void {
  navigateToStep(ONBOARDING_STEP.review);
}
