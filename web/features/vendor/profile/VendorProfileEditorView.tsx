"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CircleCheck,
  CircleHelp,
  Eye,
  Image,
  MapPin,
  Pencil,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { VendorReviewsEzView } from "@/features/reviews/VendorReviewsEzView";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  PROFILE_SECTIONS,
  profileSectionHref,
  type ProfileSectionSlug,
} from "@/lib/vendorOnboarding/constants";
import type { VendorOnboardingData } from "@/lib/vendorOnboarding/types";
import {
  profileHubCompletionPercent,
  profileHubSectionRows,
} from "@/features/vendor/profile/profileEditorSummaries";
import { displayServicesOffered } from "@/lib/vendorBrowseLabels";
import { isConfiguredPackage } from "@/lib/vendorOnboarding/packageQuality";
import { isPerUnitPricing } from "@/lib/packagePricing";
import { formatGbp } from "@/lib/money";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Banner";

const INLINE_ICON = { display: "inline", verticalAlign: "baseline" } as const;

const SECTION_ICONS: Record<number, ReactNode> = {
  2: <Briefcase size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />,
  3: <MapPin size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />,
  4: <Wallet size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />,
  6: <Calendar size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />,
  7: <Image size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />,
  8: <CircleHelp size={20} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />,
};

type VendorProfileEditorViewProps = {
  data: VendorOnboardingData;
  update: (patch: Partial<VendorOnboardingData>) => void;
  listingVisible: boolean;
  saving: boolean;
  onSave: () => void;
  vendorUserId: string;
  sectionEditor: ReactNode;
  activeSectionSlug: ProfileSectionSlug | null;
};

function lowestPackagePrice(data: VendorOnboardingData): string | null {
  const prices = data.packages
    .filter((item) => isConfiguredPackage(item))
    .map((item) => Number.parseFloat(item.price))
    .filter((value) => !Number.isNaN(value));
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const pkg = data.packages.find((item) => Number.parseFloat(item.price) === min);
  const suffix =
    pkg && isPerUnitPricing(pkg.pricingMode) ? ` per ${pkg.unitLabel.trim() || "person"}` : "";
  return `${formatGbp(min, { decimals: 2, grouping: false })}${suffix}`;
}

/** Live approved-vendor profile (design V28): checklist hub, section editor, and preview aside. */
export function VendorProfileEditorView({
  data,
  update,
  listingVisible,
  saving,
  onSave,
  vendorUserId,
  sectionEditor,
  activeSectionSlug,
}: VendorProfileEditorViewProps) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "details";
  const hubRows = profileHubSectionRows(data);
  const completion = profileHubCompletionPercent(data);
  const publicHref = `/client/browse/${encodeURIComponent(vendorUserId)}`;
  const serviceLabel = displayServicesOffered(data.servicesOffered)[0] ?? "Vendor";
  const fromPrice = lowestPackagePrice(data);

  if (activeSectionSlug) {
    const sectionIndex = PROFILE_SECTIONS.findIndex((section) => section.slug === activeSectionSlug);
    const previousSection = sectionIndex > 0 ? PROFILE_SECTIONS[sectionIndex - 1] : null;
    return (
      <div className="ez-stack ez-stack--lg">
        <PageHeader descriptionSize="body"
          eyebrow="Business"
          title="Your profile"
          description="Edit one section, then save."
          actions={
            <ButtonLink variant="ghost" href="/vendor/profile">
              Back to overview
            </ButtonLink>
          }
        />
        <Card>
          <Card.Body className="vendor-setup">{sectionEditor}</Card.Body>
          <Card.Footer>
            <ButtonLink
              variant="ghost"
              className="mr-auto"
              href={previousSection ? profileSectionHref(previousSection.slug) : "/vendor/profile"}>
              Back
            </ButtonLink>
            <Button type="button" disabled={saving} onClick={onSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </Card.Footer>
        </Card>
      </div>
    );
  }

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader descriptionSize="body"
        eyebrow="Business"
        title="Your profile"
        description="This is what clients see on Eventtz."
        actions={
          <>
            <ButtonLink variant="secondary" href={publicHref} target="_blank" rel="noreferrer">
              <Eye size={18} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />
              View public page
            </ButtonLink>
            <Button type="button" disabled={saving} onClick={onSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />

      <Banner
        tone="success"
        icon={<CircleCheck size={20} strokeWidth={1.75} aria-hidden />}
        title="Your profile is live"
        action={
          listingVisible ? null : (
            <ButtonLink href="/vendor/payments?tab=account">Set up payouts</ButtonLink>
          )
        }>
        <p className="ez-small text-inherit">
          {listingVisible
            ? "Clients can find you in search. Edits to prices or photos may be reviewed before they show."
            : "Complete payout setup or listing requirements to appear in search."}
        </p>
      </Banner>

      <div className="ez-tabs" role="tablist">
        <Link
          className={`ez-tab${tab === "details" ? " ez-tab--active" : ""}`}
          href="/vendor/profile"
        >
          Details
        </Link>
        <Link
          className={`ez-tab${tab === "reviews" ? " ez-tab--active" : ""}`}
          href="/vendor/profile?tab=reviews"
        >
          Reviews
        </Link>
      </div>

      {tab === "reviews" ? (
        <VendorReviewsEzView embedded />
      ) : (
        <div className="ez-split">
          <div className="ez-split__main ez-stack ez-stack--lg">
            <Card>
              <Card.Header>
                <span className="ez-h3">Profile sections</span>
                <Badge tone="success">{completion}% complete</Badge>
              </Card.Header>
              <Card.Body>
                {hubRows.map((row) => (
                  <div className="ez-list-row" key={row.slug}>
                    <span className="ez-icon-tile">{SECTION_ICONS[row.step]}</span>
                    <div className="ez-list-row__main">
                      <span className="ez-strong">{row.title}</span>
                      <span className="ez-small">{row.summary}</span>
                    </div>
                    <Badge tone={row.badge.tone}>{row.badge.label}</Badge>
                    <ButtonLink
                      variant="secondary"
                      size="sm"
                      href={profileSectionHref(row.slug)}>
                      <Pencil size={16} strokeWidth={1.75} aria-hidden style={INLINE_ICON} />
                      Edit
                    </ButtonLink>
                  </div>
                ))}
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <span className="ez-h3">Quick edit: about your business</span>
              </Card.Header>
              <Card.Body>
                <div className="ez-field">
                  <label className="ez-label" htmlFor="vendor-profile-bio">Description</label>
                  <textarea
                    className="ez-input ez-input--area"
                    id="vendor-profile-bio"
                    value={data.aiBioDraft}
                    maxLength={600}
                    onChange={(event) => update({ aiBioDraft: event.target.value })}
                  />
                  <span className="ez-help">{data.aiBioDraft.length} of 600 characters</span>
                </div>
              </Card.Body>
              <Card.Footer>
                <Button type="button" disabled={saving} onClick={onSave}>
                  {saving ? "Saving…" : "Save description"}
                </Button>
              </Card.Footer>
            </Card>
          </div>

          <div className="ez-split__aside ez-stack ez-stack--lg">
            <Card>
              <Card.Header>
                <span className="ez-h3">How clients see you</span>
              </Card.Header>
              <Card.Body>
                <div className="ez-vcard">
                  <div className="ez-vcard__media">
                    {data.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vendor-uploaded URL
                      <img src={data.profileImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="ez-media-ph h-full">
                        <Image size={40} strokeWidth={1.75} aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="ez-vcard__body">
                    <h3 className="ez-vcard__name">{data.businessName.trim() || "Your business"}</h3>
                    <div className="ez-vcard__meta">
                      <span>{serviceLabel}</span>
                      {data.baseCity.trim() ? (
                        <>
                          <span>·</span>
                          <span>{data.baseCity.trim()}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {fromPrice ? (
                    <div className="ez-vcard__foot">
                      <span className="ez-caption">From</span>
                      <span className="ez-money">{fromPrice}</span>
                    </div>
                  ) : null}
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
