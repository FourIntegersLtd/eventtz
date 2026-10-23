"use client";

import {
  CircleCheck,
  Clock,
  ImageIcon,
  Info,
  Lock,
  MapPin,
  Shield,
  Sparkle,
  Star,
  TriangleAlert,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { MIN_PORTFOLIO_IMAGES } from "../../../../lib/vendorOnboarding/constants";
import { ONBOARDING_FORM_STEP_COUNT } from "../../../../lib/vendorOnboarding/onboardingProgress";
import { BUSINESS_STEP_SERVICE_CHIPS, RADIUS_OPTIONS, SERVICE_OPTIONS } from "../../../../lib/vendorOnboarding/constants";
import { describeWorkingDays, reviewReadiness } from "../reviewSummary";
import type { VendorOnboardingData } from "../../../../lib/vendorOnboarding/types";
import { BOOKING_SERVICE_FEE_PERCENT } from "@/lib/bookingServiceFee";
import { isPerUnitPricing, parsePackageQuantity } from "@/lib/packagePricing";
import { formatGbp, formatPence } from "@/lib/money";

type WizardAsideProps = {
  step: number;
  data: VendorOnboardingData;
};

/** Aside card with an optional icon tile and a title row, as used across the wizard. */
function AsideCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ez-card">
      <div className="ez-card__head">
        <div className="ez-hrow">
          {icon}
          <span className="ez-h3">{title}</span>
        </div>
      </div>
      <div className="ez-card__body">{children}</div>
    </div>
  );
}

/** Step 1: why we ask for contact details, plus how long the whole flow takes. */
function AccountAside() {
  const progressPercent = Math.floor((1 / ONBOARDING_FORM_STEP_COUNT) * 100);
  return (
    <div className="ez-stack ez-stack--lg">
      <AsideCard
        title="Why we ask"
        icon={
          <span className="ez-icon-tile ez-icon-tile--gold">
            <Lock strokeWidth={1.75} aria-hidden />
          </span>
        }
      >
        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Clients see your name and number after booking, so they can reach
            you on the day.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            We use your phone only for urgent booking changes, never marketing.
          </li>
        </ul>
      </AsideCard>
      <div className="ez-card">
        <div className="ez-card__body">
          <div className="ez-hrow">
            <Clock size={20} strokeWidth={1.75} aria-hidden />
            <div>
              <div className="ez-strong">About 12 minutes in total</div>
              <div className="ez-caption">
                Most vendors finish in one sitting.
              </div>
            </div>
          </div>
          <div className="ez-progress" style={{ marginTop: 14 }}>
            <div
              className="ez-progress__bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lowest positive package price as "£18.00", or null when no package is priced yet. */
function lowestPackagePrice(data: VendorOnboardingData): string | null {
  const prices = data.packages
    .map((item) => Number(item.price))
    .filter((price) => price > 0);
  return prices.length > 0 ? formatGbp(Math.min(...prices), { decimals: 2, grouping: false }) : null;
}

/** Step 2: a live preview of how the listing card will read to clients. */
function BusinessAside({ data }: { data: VendorOnboardingData }) {
  const serviceLabel =
    BUSINESS_STEP_SERVICE_CHIPS.find(
      (option) => option.value === data.servicesOffered[0],
    )?.label ??
    SERVICE_OPTIONS.find((option) => option.value === data.servicesOffered[0])?.label;
  const fromPrice = lowestPackagePrice(data);
  const categoryAndCity = [serviceLabel, data.baseCity.trim()].filter(Boolean);
  return (
    <div className="ez-card">
      <div className="ez-card__head">
        <span className="ez-h3">Live preview</span>
        <span className="ez-badge ez-badge--neutral ez-badge--plain">
          How clients see you
        </span>
      </div>
      <div className="ez-card__body">
        <div className="ez-vcard">
          <div className="ez-vcard__media">
            <ImageIcon
              className="ez-ph"
              size={40}
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="ez-vcard__body">
            <h3 className="ez-vcard__name">
              {data.businessName.trim() || "Your business name"}
            </h3>
            <div className="ez-vcard__meta">
              {categoryAndCity.map((part, index) => (
                <Fragment key={part}>
                  {index > 0 ? <span>·</span> : null}
                  <span>{part}</span>
                </Fragment>
              ))}
            </div>
            <div className="ez-vcard__meta">
              <span className="ez-rating">
                <Star size={15} strokeWidth={1.75} aria-hidden />
                New
              </span>
            </div>
          </div>
          {fromPrice ? (
            <div className="ez-vcard__foot">
              <span className="ez-caption">From</span>
              <span className="ez-money">{fromPrice}</span>
            </div>
          ) : null}
        </div>
        <p className="ez-caption" style={{ marginTop: 12 }}>
          Updates as you type. Clients only see this after approval.
        </p>
      </div>
    </div>
  );
}

/** Step 3: where clients will find you, and tips on choosing a base city. */
function LocationAside({ data }: { data: VendorOnboardingData }) {
  const outwardCode = data.postalCode.trim().split(/\s+/)[0]?.toUpperCase();
  const place = [data.baseCity.trim(), outwardCode].filter(Boolean).join(", ");
  const radius = RADIUS_OPTIONS.find(
    (option) => option.value === data.travelRadius,
  );
  return (
    <div className="ez-stack ez-stack--lg">
      <div className="ez-card">
        <div className="ez-card__head">
          <span className="ez-h3">Where clients will find you</span>
        </div>
        <div className="ez-card__body">
          <div className="ez-media-ph" style={{ height: 200 }}>
            <MapPin strokeWidth={1.75} aria-hidden />
          </div>
          <div className="ez-stack ez-stack--sm" style={{ marginTop: 14 }}>
            <span className="ez-strong">{place || "Add your base city"}</span>
            {radius ? (
              <span className="ez-small">
                Within {radius.label.toLowerCase()}. {radius.context}.
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <AsideCard
        title="Good to know"
        icon={
          <span className="ez-icon-tile ez-icon-tile--gold">
            <Info strokeWidth={1.75} aria-hidden />
          </span>
        }
      >
        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Clients search by town, so use the city you are really based in.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Your exact address is never shown publicly.
          </li>
        </ul>
      </AsideCard>
    </div>
  );
}

/** Guest count shown in the fee illustration when a per-item package sets no minimum. */
const ILLUSTRATION_QUANTITY = 60;

/** Step 4: package tips, and what a client would pay for the first priced package. */
function PricingAside({ data }: { data: VendorOnboardingData }) {
  const priced = data.packages.find((item) => Number(item.price) > 0);
  let illustration: ReactNode = null;
  if (priced) {
    const perUnit = isPerUnitPricing(priced.pricingMode);
    const quantity = perUnit
      ? (parsePackageQuantity(priced.minQuantity) ?? ILLUSTRATION_QUANTITY)
      : 1;
    const pricePence = Math.round(Number(priced.price) * 100) * quantity;
    const feePence = Math.round(
      (pricePence * BOOKING_SERVICE_FEE_PERCENT) / 100,
    );
    const unit = priced.unitLabel.trim() || "item";
    illustration = (
      <div className="ez-card">
        <div className="ez-card__head">
          <span className="ez-h3">What a client pays</span>
        </div>
        <div className="ez-card__body">
          <div className="ez-lines">
            <div className="ez-lines__row">
              <span>
                {perUnit ? `Your price for ${quantity} ${unit}` : "Your price"}
              </span>
              <span>{formatPence(pricePence)}</span>
            </div>
            <div className="ez-lines__row">
              <span>Eventtz service fee ({BOOKING_SERVICE_FEE_PERCENT}%)</span>
              <span>{formatPence(feePence)}</span>
            </div>
            <div className="ez-lines__total">
              <span>Client total</span>
              <span>{formatPence(pricePence + feePence)}</span>
            </div>
          </div>
          <p className="ez-caption" style={{ marginTop: 10 }}>
            You receive your price in full. The fee is added on top at checkout.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="ez-stack ez-stack--lg">
      <AsideCard
        title="Strong packages"
        icon={
          <span className="ez-icon-tile ez-icon-tile--gold">
            <Sparkle size={20} strokeWidth={1.75} aria-hidden />
          </span>
        }
      >
        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Name the package for what the client gets.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            List what is included, so there are fewer questions.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            One price per package. Clients choose the quantity when they
            enquire.
          </li>
        </ul>
      </AsideCard>
      {illustration}
    </div>
  );
}

/** Step 5: how to choose a policy, and where it can be changed later. */
function CancellationAside() {
  return (
    <div className="ez-stack ez-stack--lg">
      <AsideCard
        title="Choosing a policy"
        icon={
          <span className="ez-icon-tile ez-icon-tile--gold">
            <Sparkle size={20} strokeWidth={1.75} aria-hidden />
          </span>
        }
      >
        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Flexible wins more small bookings. Strict protects dates you turn
            other work away for.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Clients see the policy on your profile and again before they pay.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Most vendors pick Moderate.
          </li>
        </ul>
      </AsideCard>
      <div className="ez-card">
        <div className="ez-card__body">
          <div className="ez-hrow">
            <Lock size={20} strokeWidth={1.75} aria-hidden />
            <span className="ez-small">
              You can change this later in Settings. A booking keeps the policy
              it was made under.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step 6: a summary of the week as entered, plus tips. */
function AvailabilityAside({ data }: { data: VendorOnboardingData }) {
  const capacity = Number.parseInt(data.maxBookingsPerDay, 10);
  const blockedCount = data.blockedDates.length;
  return (
    <div className="ez-stack ez-stack--lg">
      <AsideCard title="Your week">
        <div className="ez-lines">
          <div className="ez-lines__row">
            <span>Working days</span>
            <span>{describeWorkingDays(data.availableWeekdays)}</span>
          </div>
          <div className="ez-lines__row">
            <span>Capacity per day</span>
            <span>
              {Number.isNaN(capacity)
                ? "Not set"
                : `${capacity} ${capacity === 1 ? "event" : "events"}`}
            </span>
          </div>
          <div className="ez-lines__row">
            <span>Blocked dates</span>
            <span>
              {blockedCount} {blockedCount === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
        <p className="ez-caption" style={{ marginTop: 10 }}>
          Clients cannot enquire for days you block or days that are full.
        </p>
      </AsideCard>
      <AsideCard
        title="Tips"
        icon={
          <span className="ez-icon-tile ez-icon-tile--gold">
            <Sparkle size={20} strokeWidth={1.75} aria-hidden />
          </span>
        }
      >
        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Block holidays now so you never have to decline.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            You can change all of this later in Profile, Availability.
          </li>
        </ul>
      </AsideCard>
    </div>
  );
}

/** Step 7: photo tips, and the reminder that approval needs the minimum number of photos. */
function PortfolioAside() {
  return (
    <div className="ez-stack ez-stack--lg">
      <AsideCard
        title="Photos that get bookings"
        icon={
          <span className="ez-icon-tile ez-icon-tile--gold">
            <Sparkle size={20} strokeWidth={1.75} aria-hidden />
          </span>
        }
      >
        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Use bright, sharp photos of real events you have done.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Show food, setup and happy guests, not stock images.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Put your best photo first: it becomes the cover.
          </li>
        </ul>
      </AsideCard>
      <div className="ez-card">
        <div className="ez-card__body">
          <div
            className="ez-banner ez-banner--warning"
            style={{ border: 0, padding: 0, background: "none" }}
          >
            <TriangleAlert size={20} strokeWidth={1.75} aria-hidden />
            <div className="ez-banner__body">
              <div className="ez-banner__title">
                You can still submit with fewer than {MIN_PORTFOLIO_IMAGES}
              </div>
              <p className="ez-small" style={{ color: "inherit" }}>
                But we cannot approve you until at least {MIN_PORTFOLIO_IMAGES}{" "}
                photos are uploaded.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step 8: why documents help, and how they are stored. */
function AdditionalInfoAside() {
  return (
    <div className="ez-stack ez-stack--lg">
      <AsideCard
        title="Why documents help"
        icon={
          <span className="ez-icon-tile ez-icon-tile--gold">
            <Shield strokeWidth={1.75} aria-hidden />
          </span>
        }
      >
        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Vendors with a certificate get a Verified mark on their profile.
          </li>
          <li className="ez-small" style={{ marginBottom: 6 }}>
            Documents are seen by our team only, never published.
          </li>
        </ul>
      </AsideCard>
      <div className="ez-card">
        <div className="ez-card__body">
          <div className="ez-hrow">
            <Lock size={20} strokeWidth={1.75} aria-hidden />
            <span className="ez-small">
              Stored securely and deleted if you close your account.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One line of the readiness checklist: a tick when met, a warning mark when not. */
function ReadinessLine({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <div className="ez-hrow">
      {met ? (
        <CircleCheck size={18} strokeWidth={1.75} aria-hidden style={{ color: "var(--ez-success)" }} />
      ) : (
        <TriangleAlert size={18} strokeWidth={1.75} aria-hidden style={{ color: "var(--ez-warning)" }} />
      )}
      <span className="ez-small">{children}</span>
    </div>
  );
}

/** Step 9: what is ready to submit, and what happens after. */
function ReviewAside({ data }: { data: VendorOnboardingData }) {
  const readiness = reviewReadiness(data);
  const allStepsDone = readiness.stepsComplete === readiness.stepsTotal;
  const enoughPhotos = readiness.photoCount >= readiness.photosNeeded;
  return (
    <div className="ez-stack ez-stack--lg">
      <AsideCard title="Ready to submit">
        <div className="ez-stack ez-stack--sm">
          <ReadinessLine met={allStepsDone}>
            {allStepsDone
              ? `All ${readiness.stepsTotal} steps complete`
              : `${readiness.stepsComplete} of ${readiness.stepsTotal} steps complete`}
          </ReadinessLine>
          <ReadinessLine met={enoughPhotos}>
            {readiness.photoCount} {readiness.photoCount === 1 ? "photo" : "photos"} ({readiness.photosNeeded} needed)
          </ReadinessLine>
          <ReadinessLine met={readiness.cancellationChosen}>
            {readiness.cancellationChosen ? "Cancellation policy chosen" : "Cancellation policy not chosen"}
          </ReadinessLine>
          <ReadinessLine met={readiness.phoneValid}>
            {readiness.phoneValid ? "Phone number looks valid" : "Phone number needs a check"}
          </ReadinessLine>
        </div>
      </AsideCard>
      <AsideCard title="What happens next">
        <ol
          className="ez-small"
          style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, listStyle: "decimal" }}
        >
          <li>Our team reviews within 2 working days.</li>
          <li>We email you the result.</li>
          <li>Once approved, set up payouts and start receiving enquiries.</li>
        </ol>
      </AsideCard>
    </div>
  );
}

/** The aside column for one wizard step. */
export function WizardAside({ step, data }: WizardAsideProps) {
  switch (step) {
    case 1:
      return <AccountAside />;
    case 2:
      return <BusinessAside data={data} />;
    case 3:
      return <LocationAside data={data} />;
    case 4:
      return <PricingAside data={data} />;
    case 5:
      return <CancellationAside />;
    case 6:
      return <AvailabilityAside data={data} />;
    case 7:
      return <PortfolioAside />;
    case 8:
      return <AdditionalInfoAside />;
    case 9:
      return <ReviewAside data={data} />;
    default:
      return null;
  }
}
