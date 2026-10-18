import Link from "next/link";
import policy from "@/lib/policyConstants.json";
import {
  getBookingServiceFeePercent,
} from "@/lib/bookingServiceFee";
import {
  FOOTER_ADDRESS_LINES,
  FOOTER_COMPANY_NAME,
  FOOTER_CONTACT_EMAIL,
} from "@/lib/footerLinks";

/** Vendor price used in the worked examples, in pounds. */
const EXAMPLE_VENDOR_PRICE_GBP = 1000;

/** Date the current Terms were last edited (shown to readers). */
const TERMS_LAST_UPDATED = "18 October 2026";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

/**
 * The contents list: one entry per numbered section, grouped into parts.
 * Section ids are linked from other pages (`#fees-taxes`, `#liability`): keep them stable.
 */
const CONTENTS = [
  {
    part: "Part A. General",
    sections: [
      { id: "the-platform", title: "About Eventtz and our role" },
      { id: "words", title: "Definitions" },
      { id: "accounts", title: "Eligibility and your account" },
      { id: "prohibited-conduct", title: "Acceptable use" },
      { id: "content", title: "Your content and our intellectual property" },
      { id: "reviews", title: "Reviews" },
    ],
  },
  {
    part: "Part B. Bookings and payments",
    sections: [
      { id: "bookings-payments", title: "Making a Booking" },
      { id: "fees-taxes", title: "Prices, fees and taxes" },
      { id: "payments", title: "Payments and how we hold funds" },
      { id: "cancellations-refunds", title: "Cancellations and refunds" },
      { id: "event-completion-payouts", title: "Completion and Vendor payouts" },
      { id: "disputes", title: "Disputes" },
      { id: "chargebacks", title: "Chargebacks" },
    ],
  },
  {
    part: "Part C. Vendor terms",
    sections: [
      { id: "vendor-responsibilities", title: "Vendor obligations" },
      { id: "vendor-terms", title: "Cancellations by Vendors" },
      { id: "off-platform", title: "Keeping Bookings on Eventtz" },
      { id: "ranking", title: "How Vendors are ranked" },
      { id: "vendor-suspension", title: "Warnings, suspension and termination" },
      { id: "vendor-complaints", title: "Vendor complaints" },
      { id: "vendor-information", title: "Vendor information" },
    ],
  },
  {
    part: "Part D. Client terms",
    sections: [
      { id: "client-responsibilities", title: "Client obligations and the event day" },
    ],
  },
  {
    part: "Part E. Legal",
    sections: [
      { id: "disclaimers", title: "Disclaimers" },
      { id: "liability", title: "Limitation of liability" },
      { id: "termination", title: "Closing your account" },
      { id: "changes-to-terms", title: "Changes to these Terms" },
      { id: "general", title: "General" },
      { id: "governing-law", title: "Governing law" },
      { id: "contact", title: "Contact us" },
    ],
  },
] as const;

type SectionId = (typeof CONTENTS)[number]["sections"][number]["id"];

/** Every section in contents order. */
const ALL_SECTIONS: readonly { id: SectionId; title: string }[] = CONTENTS.flatMap(
  (group): readonly { id: SectionId; title: string }[] => group.sections,
);

/** Section number for each id, counted in contents order, so cross-references never drift. */
const SECTION_NUMBERS = new Map<string, number>(
  ALL_SECTIONS.map((section, index) => [section.id, index + 1]),
);

/** The "N. Title" heading for a section id. */
function sectionHeading(id: SectionId): string {
  const section = ALL_SECTIONS.find((entry) => entry.id === id);
  return `${SECTION_NUMBERS.get(id)}. ${section?.title ?? ""}`;
}

/** A link to another section, labelled "section N". */
function SectionRef({ id }: { id: SectionId }) {
  return <a href={`#${id}`}>section {SECTION_NUMBERS.get(id)}</a>;
}

/** Turns "2026-11-01" into "1 November 2026" without time-zone surprises. */
function formatVersionDate(version: string): string {
  const [year, month, day] = version.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Joins words the way a person would say them: "a, b and c". */
function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Formats a pound amount, e.g. 1000 becomes "£1,000". */
function pounds(amount: number): string {
  return `£${amount.toLocaleString("en-GB")}`;
}

/** Capitalises the first letter of a word. */
function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Says how much of the Vendor Price comes back, in everyday words. */
function refundLabel(percent: number): string {
  if (percent === 100) return "Full refund";
  if (percent === 0) return "No refund";
  return `${percent}%`;
}

/**
 * Turns one policy's tiers (days before the event, percent back) into table
 * rows. Tiers run from the earliest cut-off down to zero days.
 */
function tierRows(tiers: readonly (readonly number[])[]) {
  return tiers.map(([minDays, percent], index) => {
    const previousMinDays = index > 0 ? tiers[index - 1][0] : null;
    let when: string;
    if (previousMinDays === null) {
      when = `${minDays} days or more before the event`;
    } else if (minDays === 0) {
      when = `Less than ${previousMinDays} days before the event`;
    } else {
      when = `${minDays} to ${previousMinDays - 1} days before the event`;
    }
    return { when, refund: refundLabel(percent) };
  });
}

/**
 * The Terms of Service page: plain English, in the structure of a professional
 * marketplace agreement (general terms, bookings and payments, vendor terms,
 * client terms, legal).
 *
 * Every rule here must match what the app does. Every number comes from
 * `lib/policyConstants.json` (which a test keeps equal to the API's settings) or
 * from `bookingServiceFee.ts`, so this page cannot drift from the product. The
 * cancellation tiers mirror `api/app/features/bookings/domain_cancellation.py`.
 * Section numbers come from `CONTENTS`; link between sections with `SectionRef`.
 */
export function TermsOfServiceContent() {
  const serviceFeePercent = getBookingServiceFeePercent();
  const exampleFeeGbp = (EXAMPLE_VENDOR_PRICE_GBP * serviceFeePercent) / 100;
  const effectiveDate = formatVersionDate(policy.termsVersion);
  const defaultReportHours = policy.reportWindowHoursDefault;
  const categoryReportWindows = Object.entries(policy.reportWindowHoursByCategory);
  const splitCategories = joinWords(policy.deliverySplitCategories);
  const depositCategories = joinWords(policy.depositCategories);
  const moderateExampleRefundPercent = policy.cancellationPresets.moderate[1][1];
  const exampleRefundGbp =
    (EXAMPLE_VENDOR_PRICE_GBP * moderateExampleRefundPercent) / 100;
  const presetOrder = ["flexible", "moderate", "strict"] as const;

  return (
    <>
      <h1>Terms of Service</h1>
      <p className="compliance-meta">
        Effective date: {effectiveDate}
        <br />
        Last updated: {TERMS_LAST_UPDATED}
      </p>

      <section id="about-these-terms">
        <h2>About these Terms</h2>
        <p>
          These Terms of Service (the “Terms”) form a legal agreement between you
          and {FOOTER_COMPANY_NAME}. They apply to everyone who uses Eventtz,
          whether you are booking an event service or offering one. By creating
          an account or using the Platform, you accept these Terms.
        </p>
        <p>
          Thank you for choosing Eventtz. We have written these Terms to be as
          clear and fair as we can, so everyone knows what to expect. If anything
          is unclear, please get in touch and we will be happy to help.
        </p>
        <p>
          Part A applies to everyone. Part B explains how Bookings, payments and
          refunds work. Part C applies only to Vendors and Part D only to
          Clients. Part E contains the legal terms that apply to everyone.
        </p>
      </section>

      <section id="short-version" className="compliance-summary">
        <h2>Summary of key points</h2>
        <p>
          This summary is for convenience only. It does not replace the full
          Terms, which apply if there is any difference.
        </p>
        <ul>
          <li>
            Eventtz is a marketplace that connects Clients with event Vendors in
            the UK. The contract for the event service is between the Client and
            the Vendor.
          </li>
          <li>
            Clients pay Eventtz at checkout. We hold the payment and release it
            to the Vendor after the event.
          </li>
          <li>
            Clients pay a {serviceFeePercent}% Service Fee on top of the Vendor
            Price. Vendors pay no commission.
          </li>
          <li>
            If a Client cancels, the refund depends on the Vendor’s cancellation
            policy and how close the event is. The Service Fee is always
            refunded.
          </li>
          <li>If a Vendor cancels, the Client receives a full refund.</li>
          <li>
            If something goes wrong, please report it from the Booking within{" "}
            {defaultReportHours} hours of the event ending (longer for some
            services). We hold the Vendor’s payout while we look into it.
          </li>
        </ul>
      </section>

      {/* ---------- Part A. General ---------- */}
      <p className="compliance-part">Part A. General</p>

      <section id="the-platform">
        <h2>{sectionHeading("the-platform")}</h2>
        <p>
          Eventtz is an online marketplace where Clients find and book African
          event Vendors in the UK. We operate the Platform and process payments.
          We do not provide event services ourselves. Each Vendor is an
          independent business and is responsible for the services it agrees to
          provide.
        </p>
        <p>
          When you make a Booking, the contract for the event service is between
          the Client and the Vendor. Eventtz is not a party to that contract and
          is not responsible for how the Vendor performs it. The payment, refund
          and dispute rules in these Terms still apply to every Booking.
        </p>
      </section>

      <section id="words">
        <h2>{sectionHeading("words")}</h2>
        <p>In these Terms:</p>
        <ul>
          <li>
            <strong>“Eventtz”, “we”, “us” and “our”</strong> mean{" "}
            {FOOTER_COMPANY_NAME}, the company that operates the Platform.
          </li>
          <li><strong>“You”</strong> means the person using the Platform.</li>
          <li><strong>“Client”</strong> means a person who books a Vendor.</li>
          <li>
            <strong>“Vendor”</strong> means a business offering an event service
            on the Platform, such as a caterer, baker, DJ, photographer,
            decorator, MC, makeup artist, hair stylist, event planner or rental
            company.
          </li>
          <li>
            <strong>“Booking”</strong> means an agreement made on the Platform
            between a Client and a Vendor for a service on a set date.
          </li>
          <li>
            <strong>“Vendor Price”</strong> means the total amount the Vendor
            charges for a Booking, including any extras or discounts the Vendor
            has added.
          </li>
          <li>
            <strong>“Service Fee”</strong> means the Eventtz fee the Client pays
            on top of the Vendor Price.
          </li>
          <li>
            <strong>“Payout”</strong> means the transfer of the Vendor’s money
            for a Booking from Eventtz to the Vendor. “Paid out” has the same
            meaning.
          </li>
          <li>
            <strong>“Messages”</strong> means the chat on a Booking page on the
            Platform.
          </li>
          <li>
            <strong>“Platform”</strong> means the Eventtz website and app.
          </li>
        </ul>
      </section>

      <section id="accounts">
        <h2>{sectionHeading("accounts")}</h2>
        <ul>
          <li>Eventtz is for people aged {policy.minimumAge} and over.</li>
          <li>Please keep the information you give us accurate and up to date.</li>
          <li>
            Please keep your password private and use your account only
            yourself, so it stays secure.
          </li>
          <li>You are responsible for activity on your account.</li>
          <li>
            In rare cases we may need to suspend or close an account that does
            not follow these Terms or the law. <SectionRef id="termination" /> explains how, and{" "}
            <SectionRef id="vendor-suspension" /> sets out the notice Vendors
            receive.
          </li>
        </ul>
      </section>

      <section id="prohibited-conduct">
        <h2>{sectionHeading("prohibited-conduct")}</h2>
        <p>
          We want Eventtz to be a safe, welcoming and trustworthy place for
          everyone. So we ask that you do not:
        </p>
        <ul>
          <li>use the Platform for anything unlawful or fraudulent, or to harm anyone;</li>
          <li>harass, threaten or discriminate against anyone, or put anyone’s safety at risk;</li>
          <li>
            copy large parts of the Platform by automated means, reverse
            engineer our software, or try to disrupt or overload the Platform;
          </li>
          <li>upload malware, or content you do not have the right to share;</li>
          <li>pretend to be someone else, or misrepresent who you work for.</li>
        </ul>
      </section>

      <section id="content">
        <h2>{sectionHeading("content")}</h2>
        <p>
          You keep ownership of anything you upload, such as photos,
          descriptions and reviews. You give us a licence to store and display
          it on the Platform and to use it to promote Eventtz. You remain free to
          use it anywhere else. The Eventtz name, logo, website and software
          belong to us.
        </p>
        <p>
          Our staff may read the Messages on a Booking where necessary to resolve
          a dispute or to keep people safe.
        </p>
      </section>

      <section id="reviews">
        <h2>{sectionHeading("reviews")}</h2>
        <ul>
          <li>
            Only a Client with a completed Booking can review that Vendor, and
            only once for each Booking.
          </li>
          <li>
            A review is the Client’s own opinion, not the opinion of Eventtz.
          </li>
          <li>
            Clients rely on reviews, so they need to be genuine. We do not
            accept fake reviews, reviews written by the Vendor, or reviews given
            in exchange for a reward.
          </li>
          <li>
            We ask Vendors not to penalise a Client for a review, offer anything
            to have a review changed or removed, or include any contract term
            that stops Clients leaving a review.
          </li>
          <li>
            A Vendor may be offered the chance to post one factual, courteous
            reply to a review.
          </li>
          <li>
            We remove a review only if it is unlawful, abusive, fake or unrelated
            to the Booking. We do not remove a review because a Vendor disagrees
            with it.
          </li>
        </ul>
      </section>

      {/* ---------- Part B. Bookings and payments ---------- */}
      <p className="compliance-part">Part B. Bookings and payments</p>

      <section id="bookings-payments">
        <h2>{sectionHeading("bookings-payments")}</h2>
        <ul>
          <li>
            A Booking starts when the Client sends a request. The Vendor may
            accept it, send a quote, or decline it.
          </li>
          <li>
            <strong>Once the Vendor accepts, the Client has{" "}
            {policy.paymentDeadlineHours} hours to pay.</strong> This keeps the
            Vendor’s calendar fair for everyone. If payment is not made in time,
            the Booking is cancelled, the Client is not charged, and the date is
            freed up for other Clients.
          </li>
          <li>
            Payment is also due at least{" "}
            {policy.paymentDeadlineHoursBeforeEvent} hours before the event, so
            the deadline is shorter when the event is soon. If the Vendor accepts
            less than {policy.paymentDeadlineHoursBeforeEvent} hours before the
            event, payment is due before the event starts. The exact deadline is
            always shown on the Booking.
          </li>
        </ul>
      </section>

      <section id="fees-taxes">
        <h2>{sectionHeading("fees-taxes")}</h2>
        {/* ASSUMPTION: awaiting solicitor – Q1: is the service fee VAT-inclusive, and is Eventtz the supplier of that fee for VAT purposes? Default: "includes VAT where it applies". */}
        {/* ASSUMPTION: confirm against the Stripe account settings (plan 1C, owner O) – who bears Stripe Connect payout fees. Default: vendor bears payout fees, Eventtz bears card-processing fees. */}
        <ul>
          <li>
            <strong>Clients</strong> pay a Service Fee of {serviceFeePercent}% of
            the Vendor Price. It is shown on the Vendor’s listing and again before
            payment, and includes VAT where VAT applies. For example, if the
            Vendor Price is {pounds(EXAMPLE_VENDOR_PRICE_GBP)}, the Service Fee is{" "}
            {pounds(exampleFeeGbp)} and the Client pays{" "}
            {pounds(EXAMPLE_VENDOR_PRICE_GBP + exampleFeeGbp)}.
          </li>
          <li>
            A Vendor may share a referral link that reduces the Service Fee. See
            the <Link href="/compliances/referrals">Referral Policy</Link> for
            details.
          </li>
          <li>
            <strong>Vendors</strong> pay Eventtz no commission on the Vendor
            Price. Eventtz pays Stripe’s card-processing costs. Any fee Stripe
            charges for sending a Payout to the Vendor’s bank is paid by the
            Vendor.
          </li>
          <li>
            When a Booking is cancelled, the Service Fee is refunded to the
            Client at Eventtz’s cost. It is never deducted from the Vendor’s
            share.
          </li>
          <li>
            Eventtz issues the Client a payment receipt on the Vendor’s behalf.
            The Vendor is responsible for issuing any VAT invoice it is required
            to provide, and for its own tax affairs.
          </li>
        </ul>
      </section>

      <section id="payments">
        <h2>{sectionHeading("payments")}</h2>
        <ul>
          <li>
            The Client pays Eventtz at checkout, not the Vendor directly. We hold
            the payment until the Vendor is paid out after the event, in line
            with <SectionRef id="event-completion-payouts" />.
          </li>
          {/* ASSUMPTION: awaiting solicitor – limited payment collection agent wording (Eventtz collects as the Vendor's agent; Client's payment discharges their debt to the Vendor). */}
          <li>
            Eventtz collects payments as the Vendor’s limited payment collection
            agent. This means that once a Client has paid Eventtz for a Booking,
            the Client is treated as having paid the Vendor, and the Vendor
            receives that money from Eventtz.
          </li>
          <li>
            Card payments are processed by Stripe. By paying on Eventtz, you also
            agree to Stripe’s terms.
          </li>
          <li>
            Vendors receive Payouts through Stripe. Stripe needs to verify the
            Vendor’s identity and bank details before it can send a Payout.
          </li>
          <li>
            Contact details are shared between the Client and the Vendor only
            after the Client has paid.
          </li>
        </ul>
      </section>

      <section id="cancellations-refunds">
        <h2>{sectionHeading("cancellations-refunds")}</h2>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.1 Before payment</h3>
        <p>
          A Client may cancel an unpaid Booking from their bookings page at any
          time, without charge.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.2 Cancellation by the Vendor or by Eventtz</h3>
        <p>
          The Client receives a full refund, including the Service Fee, whatever
          the Vendor’s cancellation policy says.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.3 Cancellation by the Client</h3>
        <ul>
          <li>
            A Client may cancel a paid Booking from their bookings page at any
            time until the Vendor has been paid out after the event.
          </li>
          <li>The Service Fee is always refunded in full.</li>
          <li>
            The refund of the Vendor Price depends on the Vendor’s cancellation
            policy and how many days before the event the Client cancels. Any
            amount not refunded is paid to the Vendor.
          </li>
          <li>
            Every Vendor chooses one of three cancellation policies: Flexible,
            Moderate or Strict. The policy is shown on the Vendor’s profile and
            again before payment. The policy shown at the time of payment
            applies, even if the Vendor changes it later.
          </li>
          <li>
            Days are counted from the date of cancellation to the first day of
            the event. For example, cancelling on 13 June for an event on 20
            June is 7 days before the event.
          </li>
        </ul>
        {/* ASSUMPTION: awaiting solicitor – Q2: do date-specific bookings (catering, photography, makeup, hair, decor, rentals) fall under the "date-specific services" exception to the 14-day online cancellation right (Consumer Contracts Regs 2013, reg 28(1)(h)), or do some need a 14-day right beyond our cooling-off? Default below: the exception applies. */}
        <p>
          The law gives consumers a 14-day right to cancel many contracts made
          online. That right does not apply to services booked for a specific
          date, such as catering, entertainment and similar event services. The
          Vendor’s cancellation policy applies instead, together with the
          cooling-off period in {SECTION_NUMBERS.get("cancellations-refunds")}.4.
        </p>

        {/* ASSUMPTION: awaiting solicitor – Q3: is a 0% refund inside the last tier (Strict, last 30 days) fair under the Consumer Rights Act 2015, or must it carry a "further refund if the date is rebooked" duty? Default: keep 0% as built. */}
        <div className="compliance-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Policy</th>
                <th scope="col">When the Client cancels</th>
                <th scope="col">Refund of the Vendor Price</th>
              </tr>
            </thead>
            <tbody>
              {presetOrder.flatMap((presetName) =>
                tierRows(policy.cancellationPresets[presetName]).map((row) => (
                  <tr key={`${presetName}-${row.when}`}>
                    <td>{capitalise(presetName)}</td>
                    <td>{row.when}</td>
                    <td>{row.refund}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>

        <p>
          <strong>Example:</strong> the Vendor’s policy is Moderate, the Vendor
          Price is {pounds(EXAMPLE_VENDOR_PRICE_GBP)} and the Client paid a{" "}
          {pounds(exampleFeeGbp)} Service Fee. The Client cancels{" "}
          {policy.cancellationPresets.moderate[1][0] + 3} days before the event.
          The Client receives {moderateExampleRefundPercent}% of the Vendor Price
          ({pounds(exampleRefundGbp)}) plus the full Service Fee (
          {pounds(exampleFeeGbp)}), a total of{" "}
          {pounds(exampleRefundGbp + exampleFeeGbp)}. The Vendor is paid the
          remaining {pounds(EXAMPLE_VENDOR_PRICE_GBP - exampleRefundGbp)}.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.4 Cooling-off period</h3>
        <p>
          Whatever the Vendor’s policy, the Client receives a full refund if they
          cancel within {policy.coolingOffHours} hours of paying and the event is
          at least {policy.coolingOffMinDaysBeforeEvent} days away.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.5 Exceptional circumstances</h3>
        <p>
          The Client or the Vendor may ask us to cancel a Booking if any of the
          following happens:
        </p>
        <ul>
          <li>the death or serious illness of a person central to the Booking, or of a close family member;</li>
          <li>a serious injury;</li>
          <li>severe weather where the authorities have declared an emergency;</li>
          <li>government restrictions introduced after the Booking was made that prevent the event from going ahead.</li>
        </ul>
        <p>
          We may ask for evidence. If we agree, the Client receives a full
          refund, including the Service Fee, and the Vendor is not paid for that
          Booking. The cancellation does not count against the Vendor.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.6 Changing the date</h3>
        <p>
          Either party may ask to move an accepted Booking to new dates from the
          Booking page, and the other party may accept or decline. If accepted,
          only the dates change: the price, the amount paid and the cancellation
          policy stay the same. If declined, the Booking stays on the original
          dates. A request can be withdrawn until the other party responds. A
          date change cannot go ahead if the Vendor is fully booked on the new
          dates. If the Client cancels instead, the Vendor’s cancellation policy
          applies.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.7 When a Booking cannot be cancelled</h3>
        <ul>
          <li>
            Once the Vendor has been paid out, the Booking cannot be cancelled.
            If something went wrong, the Client should report a problem from the
            Booking instead (see <SectionRef id="disputes" />).
          </li>
          <li>
            A Booking with an open problem report cannot be cancelled until the
            report is resolved.
          </li>
        </ul>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.8 If the Vendor does not attend</h3>
        <p>
          If the Vendor does not attend, or does not provide the service, the
          Client should report it from the Booking as soon as possible and
          within the time limit in <SectionRef id="event-completion-payouts" />.
          If we agree the Vendor did not deliver, the Client receives a full
          refund, including the Service Fee, whatever the Vendor’s cancellation
          policy says, and the Vendor is not paid.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.9 If the Client does not attend</h3>
        <p>
          If the Client does not attend, or does not use the service booked, the
          service counts as delivered. The Vendor is paid in full and no refund
          is due.
        </p>

        <h3>{SECTION_NUMBERS.get("cancellations-refunds")}.10 How refunds are paid</h3>
        <p>
          Refunds are made to the card used for payment and usually take 5 to 10
          working days to appear.
        </p>
      </section>

      <section id="event-completion-payouts">
        <h2>{sectionHeading("event-completion-payouts")}</h2>
        <ul>
          <li>
            After the event, we ask both the Client and the Vendor to confirm it
            took place. Once both confirm, the Vendor is paid out.
          </li>
          <li>
            If no problem is reported, the Vendor is paid out automatically{" "}
            {defaultReportHours} hours after the event ends, even if one or both
            parties have not confirmed.
          </li>
          <li>
            An event ends at midnight at the end of the event day. For an event
            over several days, it ends at midnight at the end of the last day.
          </li>
          <li>
            <strong>Example:</strong> for an event on a Saturday, the Client has
            until the end of Monday ({defaultReportHours} hours) to report a
            problem. After that, the Vendor is paid out.
          </li>
          <li>
            A problem reported within that time stops the Payout while we review
            it.
          </li>
        </ul>

        <h3>Longer reporting windows</h3>
        <p>
          Some Vendors need time to collect equipment after the event, so the
          Client has longer to report a problem:
        </p>
        <ul>
          {categoryReportWindows.map(([category, hours]) => (
            <li key={category}>
              {capitalise(category)}: {hours} hours after the event ends
            </li>
          ))}
        </ul>
        <p>
          All other services have {defaultReportHours} hours. The Booking page
          always shows the exact time the window closes.
        </p>

        <h3>Photography: payment in two parts</h3>
        <p>
          Photos and videos are delivered after the event, so for{" "}
          {splitCategories} every Booking is paid out to the Vendor in two parts:
        </p>
        <ul>
          <li>
            The first part is paid out when the event is complete. The Vendor
            sets this part at between {policy.deliveryUpfrontPercentMin}% and{" "}
            {policy.deliveryUpfrontPercentMax}% of the Vendor Price (
            {policy.deliveryUpfrontPercentDefault}% by default). It is shown to
            the Client before payment.
          </li>
          <li>
            The remainder is paid out when the Client confirms receipt of the
            photos or videos, or, if the Client does not confirm, when the
            Vendor’s delivery deadline passes with no problem reported. The
            Vendor sets the delivery deadline, up to{" "}
            {policy.deliveryDeadlineDaysMax} days after the event (
            {policy.deliveryDeadlineDaysDefault} days by default). It is shown to
            the Client before payment.
          </li>
          <li>
            If the photos or videos are not delivered, the Client should report
            it from the Booking before the deadline passes. We hold the second
            part while we review the report.
          </li>
        </ul>

        <h3>Damage deposits for rentals and decor</h3>
        <p>
          For {depositCategories}, a Vendor may request a damage deposit of up to{" "}
          {pounds(policy.depositMaxGbp)}. The Client pays it with the Booking.
          It is not part of the Vendor Price and Eventtz holds it. The deposit is
          returned to the Client automatically {policy.depositClaimDays} days
          after the last day of the event, unless the Vendor makes a claim within
          that time with evidence of damage (such as photos). If the Client
          disputes a claim, we review both sides and make a fair decision. A
          Vendor can never receive more than the deposit. If we award the Vendor
          only part of it, the rest is returned to the Client automatically.
        </p>
      </section>

      <section id="disputes">
        <h2>{sectionHeading("disputes")}</h2>
        <ul>
          <li>
            The Client or the Vendor may report a problem from the Booking page.
          </li>
          <li>
            So that we can hold the Payout while we look into it, please report
            a problem before the reporting window closes: {defaultReportHours} hours after
            the event ends, or longer for some services (see{" "}
            <SectionRef id="event-completion-payouts" />).
          </li>
          <li>
            While a report is open, the Vendor is not paid out until it is
            resolved.
          </li>
          <li>
            The contract for the event service is between the Client and the
            Vendor. Eventtz is not a party to it, but we will help both sides
            resolve the problem.
          </li>
          <li>
            We make our decisions fairly and in good faith. Our decision does not
            affect your right to go to court or to use any other legal remedy.
          </li>
        </ul>
      </section>

      <section id="chargebacks">
        <h2>{sectionHeading("chargebacks")}</h2>
        <p>
          A chargeback is when a Client asks their bank to reverse a card
          payment. If a chargeback is made on a Booking:
        </p>
        <ul>
          <li>we may hold or reverse the Vendor’s Payout for that Booking;</li>
          <li>
            if the chargeback relates to the Vendor’s service, the Vendor bears
            its cost;
          </li>
          <li>
            we may deduct that amount from the Vendor’s future Payouts, or ask
            the Vendor to repay it;
          </li>
          <li>
            if we have already refunded a Client for a problem the Vendor caused,
            we may recover that refund from the Vendor.
          </li>
        </ul>
        <p>
          We tell the Vendor what has happened and share the evidence we hold,
          so the Vendor can respond before any money is recovered.
        </p>
      </section>

      {/* ---------- Part C. Vendor terms ---------- */}
      <p className="compliance-part">Part C. Vendor terms</p>

      <section id="vendor-responsibilities">
        <h2>{sectionHeading("vendor-responsibilities")}</h2>
        <p>
          Thank you for offering your services on Eventtz. This Part applies to
          Vendors only. Clients book with confidence because Vendors on Eventtz
          agree to:
        </p>
        <ul>
          <li>describe their services, prices and availability accurately;</li>
          <li>provide the services they agree to with reasonable care and skill, and within the law;</li>
          <li>reply to Booking requests and Messages honestly;</li>
          <li>confirm on the Platform when a booked event has taken place, so they can be paid out;</li>
          <li>
            choose a cancellation policy (Flexible, Moderate or Strict) and keep
            to it. The policy shown when the Client paid is the one that applies;
          </li>
          <li>
            take payment through Eventtz for any Booking that started on the
            Platform, rather than asking the Client to pay another way;
          </li>
          <li>
            ask the Client in Messages before passing the work to anyone else.
            The Vendor stays responsible for the work either way;
          </li>
          <li>
            take care of the Client’s property and venue, and put right any
            damage they cause.
          </li>
        </ul>

        <h3>Licences, insurance and food safety</h3>
        <ul>
          <li>
            Please hold every licence and form of cover that the law and the
            venues you work at require. We are only able to list Vendors who do.
          </li>
          <li>
            We recommend holding public liability insurance (cover for injury or
            damage you cause by accident). If you upload your policy, we show a
            badge on your profile.
          </li>
          <li>
            If you provide food, you will need to be registered as a food
            business and hold a food hygiene certificate. Please always give
            accurate allergen information, as Clients’ health depends on it.
          </li>
          <li>
            We ask to see these documents only if we receive a complaint about
            you. If a legally required licence or certificate expires, we give
            you time to renew it before we suspend your listing.
          </li>
        </ul>
      </section>

      <section id="vendor-terms">
        <h2>{sectionHeading("vendor-terms")}</h2>
        <ul>
          <li>
            If you cancel a paid Booking, the Client receives a full refund
            whatever your policy says. That refund, including the Service Fee, is
            never deducted from your other earnings.
          </li>
          <li>
            We keep a private record of the cancellations you make. Clients
            cannot see it.
          </li>
          <li>
            If you cancel {policy.vendorCancellationReviewCount} or more paid
            Bookings within {policy.vendorCancellationReviewDays} days, a member
            of staff reviews what happened and may issue a warning. We take no
            further action without a warning first.
          </li>
          <li>
            Cancellations for exceptional circumstances (
            {SECTION_NUMBERS.get("cancellations-refunds")}.5) never count against
            you. Nor does refusing to work in unsafe conditions (see{" "}
            <SectionRef id="client-responsibilities" />).
          </li>
        </ul>
      </section>

      <section id="off-platform">
        <h2>{sectionHeading("off-platform")}</h2>
        {/* ASSUMPTION: awaiting solicitor – circumvention clause wording (plan 1E): "originated on the Platform", mutual with clients, first breach a written warning. */}
        <ul>
          <li>
            If a Client and a Vendor were introduced on Eventtz, we ask both to
            book and pay through Eventtz for {policy.circumventionMonths} months
            from the date of introduction. This is how we keep payments
            protected and the Platform running.
          </li>
          <li>
            A Client and a Vendor are introduced on Eventtz if their first
            contact was through a request, quote or Message on the Platform.
          </li>
          <li>
            The first time this is not followed, we send a friendly written
            reminder. If it happens again, we may suspend the account.
          </li>
        </ul>
      </section>

      <section id="ranking">
        <h2>{sectionHeading("ranking")}</h2>
        <p>
          When a Client searches, we interpret what they typed to identify the
          services and requirements they mean, and show the Vendors that best
          match. Clients can sort results by price or rating. Only approved
          Vendors who have completed payout set-up are listed. Vendors cannot
          pay for a higher position.
        </p>
      </section>

      <section id="vendor-suspension">
        <h2>{sectionHeading("vendor-suspension")}</h2>
        <ul>
          <li>
            We hope it never comes to this, but we may hide a listing, or
            suspend or close an account, for: fraud; an expired licence that the
            law requires; repeated cancellations without good reason; putting
            people’s safety at risk; breaking the law; or not following these
            Terms.
          </li>
          <li>
            Whenever we hide your listing, suspend or close your account, we tell
            you why, by email and in your account.
          </li>
          <li>
            Where the problem can be fixed, we first give you a warning and an
            opportunity to fix it. A temporary listing pause comes before any
            stronger action.
          </li>
          <li>
            If we close your account, we give you{" "}
            {policy.vendorTerminationNoticeDays} days’ notice and our reasons. We
            may act immediately only where the law requires it, or where it is
            necessary to prevent fraud or harm.
          </li>
          <li>
            Bookings that are already paid are still honoured, and money you
            have earned is still paid out, unless it is held for a dispute or a
            chargeback.
          </li>
        </ul>
      </section>

      <section id="vendor-complaints">
        <h2>{sectionHeading("vendor-complaints")}</h2>
        {/* ASSUMPTION: awaiting solicitor – Q4: are we a small enterprise for P2B Articles 11 and 12 (complaints system and named mediators)? Default: we run a complaints route anyway and name no mediators. */}
        <p>
          If you disagree with a decision we have made, email{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          We acknowledge your complaint within{" "}
          {policy.complaintAcknowledgeWorkingDays} working days and give you a
          full response within {policy.complaintReplyDays} days.
        </p>
      </section>

      <section id="vendor-information">
        <h2>{sectionHeading("vendor-information")}</h2>
        <p>
          We hold the information you give us, such as your business details,
          listing and prices. Your bank details are held by Stripe. Clients can
          see your public listing, and your contact details are shared with a
          Client only after they have paid. Our{" "}
          <Link href="/compliances/privacy-policy">Privacy Policy</Link>{" "}
          explains more.
        </p>
      </section>

      {/* ---------- Part D. Client terms ---------- */}
      <p className="compliance-part">Part D. Client terms</p>

      <section id="client-responsibilities">
        <h2>{sectionHeading("client-responsibilities")}</h2>
        <p>
          Vendors are small businesses who work hard to make your event
          special. As a Client, we ask that you:
        </p>
        <ul>
          <li>give accurate and complete event details when you request a Booking;</li>
          <li>treat Vendors with courtesy and respect;</li>
          <li>pay for Bookings through Eventtz;</li>
          <li>after the event, confirm it took place, or let us know promptly about any problem;</li>
          <li>cover any damage your guests cause to a Vendor’s equipment.</li>
        </ul>

        <h3>On the event day</h3>
        <p>To help the Vendor do their best work, please make sure that:</p>
        <ul>
          <li>the Vendor can access the venue, park and set up on time;</li>
          <li>power and space are available where the Vendor needs them;</li>
          <li>the venue is safe to work in;</li>
          <li>the guest numbers and dietary requirements (such as allergies) you gave are accurate;</li>
          <li>the venue permits the music, catering or equipment you booked.</li>
        </ul>
        <p>
          A Vendor who leaves, or does not start, because the venue is unsafe is
          not treated as cancelling, and their cancellation record is not
          affected.
        </p>
        <p>
          If you would like extras on the day, please agree the price on
          Eventtz first so it can be paid through the Booking. We are not able
          to help with anything agreed outside Eventtz.
        </p>
      </section>

      {/* ---------- Part E. Legal ---------- */}
      <p className="compliance-part">Part E. Legal</p>

      <section id="disclaimers">
        <h2>{sectionHeading("disclaimers")}</h2>
        <p>
          We provide the Platform “as is”. We do not guarantee that it will
          always be available or free from errors, or that every Vendor will
          meet your expectations. Our{" "}
          <Link href="/compliances/legal-disclaimer">Legal Disclaimer</Link>{" "}
          gives more detail.
        </p>
      </section>

      <section id="liability">
        <h2>{sectionHeading("liability")}</h2>
        {/* ASSUMPTION: awaiting solicitor – Q5: liability cap figure and wording, and the claims time limit. Default: greater of fees paid in the last 12 months or £100; claims within 24 months. */}
        <ul>
          <li>
            As far as the law allows, we are not liable for indirect or
            consequential losses arising from your use of Eventtz or from a
            Vendor’s service. These are losses that do not follow directly from
            what went wrong, such as lost income or a lost opportunity.
          </li>
          <li>
            Our total liability to you for anything connected with Eventtz is
            limited to the greater of: the fees you paid Eventtz in the{" "}
            {policy.liabilityCapMonthsOfFees} months before the problem arose, or{" "}
            {pounds(policy.liabilityCapMinimumGbp)}.
          </li>
          <li>
            Nothing in these Terms limits our liability for death or personal
            injury caused by our negligence, for fraud, or for anything else the
            law does not allow us to limit.
          </li>
          <li>
            Any claim against us needs to be made within{" "}
            {policy.claimsTimeLimitMonths} months of the problem arising.
          </li>
        </ul>

        <h3>Vendor indemnity</h3>
        <p>
          If a Vendor’s service leads to a claim against Eventtz (for example,
          someone is made ill by the Vendor’s food), the Vendor is responsible for that
          claim and our reasonable costs of dealing with it.
        </p>
      </section>

      <section id="termination">
        <h2>{sectionHeading("termination")}</h2>
        <ul>
          <li>You may stop using Eventtz at any time.</li>
          <li>
            You can delete your account from Settings. We then disable your
            login and remove your personal details.
          </li>
          <li>
            We are legally required to keep booking and payment records. We keep
            them without your name, email address or phone number.
          </li>
          <li>
            To protect both sides of a Booking, an account can be deleted only
            once no payment is still being processed, no accepted Booking is
            still to take place, and no problem report is open.
          </li>
          <li>
            We may suspend or close an account where necessary to keep people
            safe, to comply with the law, or because these Terms have not been
            followed. Vendors receive warnings, reasons and notice as set out in{" "}
            <SectionRef id="vendor-suspension" />.
          </li>
        </ul>

        <h3>Money held for a Vendor who has not completed set-up</h3>
        {/* ASSUMPTION: awaiting solicitor – Q6: treatment of held vendor shares never claimed. Default: we contact the vendor, and after the period below with no set-up, may refund the client. */}
        <p>
          If a Vendor’s share is held because the Vendor has not completed
          Stripe set-up, it is paid out as soon as set-up is complete. If set-up
          is still incomplete after {policy.unclaimedVendorShareMonths} months,
          we contact the Vendor. If we receive no response, we may refund the
          Client instead.
        </p>
      </section>

      <section id="changes-to-terms">
        <h2>{sectionHeading("changes-to-terms")}</h2>
        <ul>
          <li>
            We may update these Terms. Clients receive reasonable notice by
            email.
          </li>
          <li>
            Vendors receive at least {policy.vendorTermsChangeNoticeDays} days’
            notice by email before a change takes effect. A Vendor who does not
            accept the change may close their account before it takes effect.
          </li>
          <li>
            You may be asked to accept the new version the next time you sign
            in, before you can make or accept a Booking.
          </li>
        </ul>
      </section>

      <section id="general">
        <h2>{sectionHeading("general")}</h2>
        {/* ASSUMPTION: awaiting solicitor – boilerplate clauses (entire agreement, severability, no waiver, force majeure, transfer, third-party rights, notices). */}
        <ul>
          <li>
            <strong>Entire agreement.</strong> These Terms, together with the
            policies they refer to, are the whole agreement between you and
            Eventtz about your use of the Platform.
          </li>
          <li>
            <strong>Severability.</strong> If a court finds any part of these
            Terms invalid, the rest of the Terms continue to apply.
          </li>
          <li>
            <strong>No waiver.</strong> If we do not enforce a right straight
            away, we can still enforce it later.
          </li>
          <li>
            <strong>Events outside our control.</strong> We are not responsible
            for delays or failures in running the Platform caused by events
            outside our reasonable control, such as a major outage at a supplier.
            This does not affect the refunds a Client is entitled to under these
            Terms.
          </li>
          <li>
            <strong>Transfer.</strong> We may transfer our rights and duties under
            these Terms to another business, for example if Eventtz is sold. Your
            rights under these Terms will not be reduced as a result. Please ask
            us in writing before transferring your account or your rights under
            these Terms to anyone else.
          </li>
          <li>
            <strong>Third parties.</strong> Only you and Eventtz can enforce
            these Terms. No one else has rights under the Contracts (Rights of
            Third Parties) Act 1999, except that a Vendor and a Client can each
            rely on the terms about their own Booking.
          </li>
          <li>
            <strong>Notices.</strong> We send notices to the email address on
            your account and show them in your account. You can contact us using
            the details in <SectionRef id="contact" />.
          </li>
        </ul>
      </section>

      <section id="governing-law">
        <h2>{sectionHeading("governing-law")}</h2>
        <p>
          These Terms are governed by the law of England and Wales, and the
          courts of England and Wales have jurisdiction over any dispute about
          them. If you use Eventtz as a consumer, you keep any legal protections
          you have where you live.
        </p>
      </section>

      <section id="contact">
        <h2>{sectionHeading("contact")}</h2>
        <p>
          {FOOTER_COMPANY_NAME}, {FOOTER_ADDRESS_LINES.join(", ")}.
          <br />
          Email:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>
        </p>
      </section>
    </>
  );
}
