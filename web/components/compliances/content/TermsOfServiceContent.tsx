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
const TERMS_LAST_UPDATED = "17 October 2026";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

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

/** Says how much of the vendor’s price comes back, in everyday words. */
function refundLabel(percent: number): string {
  if (percent === 100) return "All of it";
  if (percent === 0) return "None";
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
 * The Terms of Service page, written in plain English.
 *
 * Every rule here must match what the app does. Every number comes from
 * `lib/policyConstants.json` (which a test keeps equal to the API's settings) or
 * from `bookingServiceFee.ts`, so this page cannot drift from the product. The
 * cancellation tiers mirror `api/app/features/bookings/domain_cancellation.py`.
 * Section ids are linked from other pages: keep them stable.
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
      <p>
        <Link href={`/compliances/terms-of-service/${policy.previousTermsVersion}`}>
          Read the version that applied before {effectiveDate}
        </Link>
      </p>
      <p>
        These are the rules for using Eventtz. Please read them before you sign
        up or book. By creating an account or using Eventtz, you agree to them.
      </p>

      <section id="short-version">
        <h2>The short version</h2>
        <ul>
          <li>Eventtz helps you find, message and book event vendors in the UK.</li>
          <li>
            When a client pays, the money comes to Eventtz first. We hold it
            safely. The vendor is paid after the event.
          </li>
          <li>
            Clients pay a {serviceFeePercent}% Eventtz service fee on top of the
            vendor’s price. Eventtz takes no commission from the vendor’s price.
          </li>
          <li>
            If a client cancels, how much they get back depends on the vendor’s
            cancellation policy and how close the event is. The Eventtz service
            fee is always given back.
          </li>
          <li>If a vendor cancels, the client gets all their money back.</li>
          <li>
            If something goes wrong at the event, report it from the booking
            within {defaultReportHours} hours of the event ending (some
            services get longer, see section 5). We will not pay the vendor
            while we look into it.
          </li>
        </ul>
        <p>The full rules are below. If anything here seems to disagree with the full rules, the full rules apply.</p>
      </section>

      <section id="words">
        <h2>Words we use</h2>
        <ul>
          <li>
            <strong>Eventtz, we, us, our</strong> means {FOOTER_COMPANY_NAME},
            the company that runs Eventtz.
          </li>
          <li><strong>You</strong> means the person using Eventtz.</li>
          <li><strong>Client</strong> means someone booking a vendor.</li>
          <li>
            <strong>Vendor</strong> means a business offering an event service on
            Eventtz, such as a caterer, baker, DJ, photographer, decorator, MC,
            makeup artist, hair stylist, event planner or rental company.
          </li>
          <li>
            <strong>Booking</strong> means an agreement between a client and a
            vendor for a service on a set date, made on Eventtz.
          </li>
          <li>
            <strong>Vendor’s price</strong> means everything the vendor charges
            for the booking, including any extras or discounts they added.
          </li>
          <li>
            <strong>Service fee</strong> means the Eventtz fee added on top of the
            vendor’s price.
          </li>
          <li>
            <strong>Paid out</strong> means Eventtz has sent the vendor their
            money for the booking.
          </li>
          <li>
            <strong>Messages</strong> means the chat on a booking page inside
            Eventtz.
          </li>
          <li>
            <strong>Platform</strong> means the Eventtz website and app.
          </li>
        </ul>
      </section>

      <section id="the-platform">
        <h2>1. What Eventtz is</h2>
        <p>
          Eventtz is a website where clients find and book African event vendors
          in the UK. We run the website and handle the payments. We do not
          provide the event services ourselves. Each vendor is their own business
          and is responsible for doing the work they agreed to do.
        </p>
        <p>
          When you book, the contract for the service is between you and the
          vendor. Eventtz is not a party to it and is not the provider, so we
          are not responsible for how the vendor performs it. We still apply
          the payment, refund and dispute rules in these Terms.
        </p>
      </section>

      <section id="accounts">
        <h2>2. Your account</h2>
        <ul>
          <li>You must be {policy.minimumAge} or over to use Eventtz.</li>
          <li>Give us true and up-to-date information about yourself.</li>
          <li>Keep your password private. Do not share your account.</li>
          <li>You are responsible for everything done using your account.</li>
          <li>
            We may pause or close an account that breaks these rules or the law.
            Section 17 explains how and what notice vendors get.
          </li>
        </ul>
      </section>

      <section id="bookings-payments">
        <h2>3. Booking and paying</h2>
        <ul>
          <li>
            A booking starts when you send a request. The vendor can accept it,
            send a quote, or say no.
          </li>
          <li>
            <strong>You have {policy.paymentDeadlineHours} hours to pay after the
            vendor accepts.</strong> If you do not pay in time, the booking is
            cancelled, you are not charged, and the vendor’s date becomes free
            for other clients. You must also always pay at least{" "}
            {policy.paymentDeadlineHoursBeforeEvent} hours before the event, so
            the deadline is shorter if the event is soon. If the vendor accepts
            less than {policy.paymentDeadlineHoursBeforeEvent} hours before the
            event, you must pay before the event starts. We always show you the
            exact time on the booking.
          </li>
          <li>
            When you pay for a booking, the money comes to Eventtz, not straight
            to the vendor. You pay Eventtz at checkout. The vendor is paid out
            after the event. We hold the money safely until then.
          </li>
          <li>
            Card payments are handled by Stripe, a payment company. When you pay
            on Eventtz, you also agree to Stripe’s terms.
          </li>
          <li>
            Clients pay a service fee of {serviceFeePercent}% of the vendor’s
            price. You see the full amount before you pay. For example, if the
            vendor’s price is {pounds(EXAMPLE_VENDOR_PRICE_GBP)}, the service fee is{" "}
            {pounds(exampleFeeGbp)} and you pay{" "}
            {pounds(EXAMPLE_VENDOR_PRICE_GBP + exampleFeeGbp)}.
          </li>
          <li>
            A vendor may give you a referral link that lowers the service fee.
            The <Link href="/compliances/referrals">Referral Policy</Link> has
            the details.
          </li>
          <li>
            Vendors are paid through Stripe. Stripe must check the vendor’s
            identity and bank details before it can send them money.
          </li>
          <li>
            Contact details are shared between client and vendor only after the
            client has paid.
          </li>
        </ul>
      </section>

      <section id="cancellations-refunds">
        <h2>4. Cancelling and refunds</h2>

        <h3>If you have not paid yet</h3>
        <p>
          You can cancel from your bookings page at any time. You are not
          charged anything.
        </p>

        <h3>If the vendor cancels, or Eventtz cancels</h3>
        <p>
          You get all your money back, including the service fee. This applies
          whatever the vendor’s cancellation policy says.
        </p>

        <h3>If the vendor does not turn up</h3>
        <p>
          If the vendor does not turn up, or does not provide the service,
          report it from the booking as soon as you can (see{" "}
          <a href="#event-completion-payouts">section 5</a> for the time limit).
          If we agree the vendor did not deliver, you get a full refund,
          including the service fee. This is true whatever their cancellation
          policy says, and the vendor is not paid.
        </p>

        <h3>If you cancel after paying</h3>
        <ul>
          <li>
            You can cancel from your bookings page up until the vendor has been
            paid out after the event.
          </li>
          <li>You always get the Eventtz service fee back in full.</li>
          <li>
            How much of the vendor’s price you get back depends on two things:
            the vendor’s cancellation policy, and how many days before the event
            you cancel. Whatever you do not get back is paid to the vendor.
          </li>
          <li>
            Every vendor picks one of three cancellation policies: Flexible,
            Moderate or Strict. You can see it on their profile, and again before
            you pay. The policy shown when you paid is the one that applies, even
            if the vendor changes it later.
          </li>
          <li>
            To count the days, take the date you cancel and count to the first
            day of the event. For example, cancelling on 13 June for an event on
            20 June is 7 days before the event.
          </li>
        </ul>
        {/* ASSUMPTION: awaiting solicitor – Q2: do date-specific bookings (catering, photography, makeup, hair, decor, rentals) fall under the "date-specific services" exception to the 14-day online cancellation right (Consumer Contracts Regs 2013, reg 28(1)(h)), or do some need a 14-day right beyond our cooling-off? Default below: the exception applies. */}
        <p>
          The law gives you a 14-day right to cancel many things you buy online.
          That right does not apply to services booked for a set date, such as
          catering, entertainment and similar event services. So the vendor’s
          cancellation policy applies instead. On top of that, we give you a
          short cooling-off period (see below).
        </p>

        {/* ASSUMPTION: awaiting solicitor – Q3: is a 0% refund inside the last tier (Strict, last 30 days) fair under the Consumer Rights Act 2015, or must it carry a "further refund if the date is rebooked" duty? Default: keep 0% as built. */}
        <div className="compliance-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Policy</th>
                <th scope="col">When you cancel</th>
                <th scope="col">How much of the vendor’s price you get back</th>
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
          <strong>Example:</strong> the vendor’s policy is Moderate, their price
          is {pounds(EXAMPLE_VENDOR_PRICE_GBP)} and you paid a{" "}
          {pounds(exampleFeeGbp)} service fee. You cancel{" "}
          {policy.cancellationPresets.moderate[1][0] + 3} days before the event.
          You get back {moderateExampleRefundPercent}% of the vendor’s price (
          {pounds(exampleRefundGbp)}) plus the full service fee (
          {pounds(exampleFeeGbp)}), so {pounds(exampleRefundGbp + exampleFeeGbp)}{" "}
          in total. The vendor is paid the other{" "}
          {pounds(EXAMPLE_VENDOR_PRICE_GBP - exampleRefundGbp)}.
        </p>

        <h3>Changed your mind straight away?</h3>
        <p>
          Whatever the policy, you get all your money back if both of these are
          true: you cancel within {policy.coolingOffHours} hours of paying, and
          the event is at least {policy.coolingOffMinDaysBeforeEvent} days away.
        </p>

        <h3>Very serious reasons (exceptional circumstances)</h3>
        <p>
          Some things nobody can plan for. If one of these happens, the client or
          the vendor can ask us to cancel the booking:
        </p>
        <ul>
          <li>the death or serious illness of someone at the heart of the booking, or of their close family;</li>
          <li>a serious injury;</li>
          <li>severe weather, where the authorities have declared an emergency;</li>
          <li>government rules brought in after the booking was made that stop the event going ahead.</li>
        </ul>
        <p>
          We may ask for proof. If we agree, the client gets all their money
          back, including the service fee, and the vendor is not paid for that
          booking. The vendor is not blamed for the cancellation.
        </p>

        <h3>Changing the date</h3>
        <p>
          Either of you can ask to move an accepted booking to new dates from
          the booking page. The other person can say yes or no. If they say yes,
          only the dates change: the price, what you paid and the cancellation
          policy stay exactly the same. If they say no, the booking stays on the
          old dates. You can take back your request until the other person
          answers. If the vendor is fully booked on the new dates, the move
          cannot go ahead. If you cancel instead, the vendor’s cancellation
          policy applies.
        </p>

        <h3>When cancelling is not possible</h3>
        <ul>
          <li>
            Once the vendor has been paid out, the booking cannot be cancelled.
            If something went wrong, report a problem from the booking instead
            (see section 14).
          </li>
          <li>
            While a problem report is open on a booking, it cannot be cancelled
            until the report is settled.
          </li>
        </ul>

        <h3>If you do not turn up</h3>
        <p>
          If you do not attend, or do not use the service you booked, it counts
          as delivered. The vendor is paid in full and you do not get a refund.
        </p>

        <h3>How refunds reach you</h3>
        <p>
          Refunds go back to the card you paid with. They usually take 5 to 10
          working days to show in your account.
        </p>
      </section>

      <section id="event-completion-payouts">
        <h2>5. After the event: how the vendor gets paid</h2>
        <ul>
          <li>
            After the event, we ask both the client and the vendor to confirm it
            went ahead. As soon as both confirm, the vendor is paid.
          </li>
          <li>
            If nobody reports a problem, we pay the vendor automatically{" "}
            {defaultReportHours} hours after the event ends, even if one or both
            of you have not confirmed.
          </li>
          <li>
            The event “ends” at midnight at the end of the event day. For an
            event that runs over several days, it is midnight at the end of the
            last day.
          </li>
          <li>
            <strong>Example:</strong> your event is on a Saturday. You have until
            the end of Monday to report a problem (that is {defaultReportHours}{" "}
            hours). After that, the vendor is paid.
          </li>
          <li>
            If something went wrong, report it from your booking before that
            time runs out. We will not pay the vendor while we look into it.
          </li>
        </ul>

        <h3>Some services get more time</h3>
        <p>
          Some vendors need time to collect their equipment after the event, so
          you get longer to report a problem:
        </p>
        <ul>
          {categoryReportWindows.map(([category, hours]) => (
            <li key={category}>
              {capitalise(category)}: {hours} hours after the event ends
            </li>
          ))}
        </ul>
        <p>
          Every other service gets {defaultReportHours} hours. The booking page
          always shows the exact time your window closes.
        </p>

        <h3>Photography: paid in two parts</h3>
        <p>
          Photos and videos are only ready after the event. So for{" "}
          {splitCategories}, every booking is paid to the vendor in two parts:
        </p>
        <ul>
          <li>
            The first part is paid when the event is complete. The vendor picks
            the size of this part, between {policy.deliveryUpfrontPercentMin}%
            and {policy.deliveryUpfrontPercentMax}% of their price (
            {policy.deliveryUpfrontPercentDefault}% if they do not choose). You
            see it before you pay.
          </li>
          <li>
            The rest is paid when you confirm you have received your photos or
            videos. If you do not confirm, it is paid when the vendor’s delivery
            deadline passes and no problem has been reported. The vendor picks
            the delivery deadline. It can be up to {policy.deliveryDeadlineDaysMax}{" "}
            days after the event ({policy.deliveryDeadlineDaysDefault} if they do
            not choose), and you see it before you pay.
          </li>
          <li>
            If the photos or videos are not delivered, report it from the
            booking before the deadline passes. We will not pay the second part
            while we look into it.
          </li>
        </ul>

        <h3>Damage deposits for rentals and decor</h3>
        <p>
          For {depositCategories}, a vendor can ask for a damage deposit of up
          to {pounds(policy.depositMaxGbp)}. The client pays it at the same time
          as the booking, but it is not part of the price and Eventtz keeps it
          safe. It is returned to the client automatically{" "}
          {policy.depositClaimDays} days after the last day of the event, unless
          the vendor makes a claim in that time and shows proof of the damage
          (such as photos). If the client disagrees with a claim, we look at both
          sides and decide fairly. The vendor can never get more than the
          deposit. If we give the vendor only part of it, the rest goes back to
          the client automatically.
        </p>
      </section>

      <section id="fees-taxes">
        <h2>6. Fees, taxes and receipts</h2>
        {/* ASSUMPTION: awaiting solicitor – Q1: is the service fee VAT-inclusive, and is Eventtz the supplier of that fee for VAT purposes? Default: "includes VAT where it applies". */}
        {/* ASSUMPTION: confirm against the Stripe account settings (plan 1C, owner O) – who bears Stripe Connect payout fees. Default: vendor bears payout fees, Eventtz bears card-processing fees. */}
        <ul>
          <li>
            <strong>Clients</strong> pay the service fee of {serviceFeePercent}%.
            It is shown on the vendor’s card and again before you pay. It
            includes VAT where VAT applies.
          </li>
          <li>
            <strong>Vendors</strong> pay Eventtz no commission. Eventtz pays
            Stripe’s card-processing costs. Any fees Stripe charges for sending
            the vendor’s payout to their bank are the vendor’s.
          </li>
          <li>
            If a booking is cancelled, the service fee is given back to the
            client. That cost is Eventtz’s. It never comes out of the vendor’s
            share.
          </li>
          <li>
            Eventtz gives the client a payment receipt on the vendor’s behalf.
            The vendor is responsible for any VAT invoice they must give, and
            for their own tax.
          </li>
          <li>
            Referral savings are explained in the{" "}
            <Link href="/compliances/referrals">Referral Policy</Link>.
          </li>
        </ul>
      </section>

      <section id="chargebacks">
        <h2>7. Chargebacks</h2>
        <p>
          A chargeback is when a client asks their bank to take a card payment
          back. If that happens on a booking:
        </p>
        <ul>
          <li>we may pause, or reverse, the vendor’s payout for that booking;</li>
          <li>
            if the chargeback is about the vendor’s service, the vendor bears
            the cost of it;
          </li>
          <li>
            we may take that amount off the vendor’s future payouts, or ask them
            to pay it back;
          </li>
          <li>
            if we have already refunded a client for a problem the vendor
            caused, we may recover that refund from the vendor.
          </li>
        </ul>
        <p>
          We tell the vendor what happened and share the evidence we have, so
          they can respond before we take any money.
        </p>
      </section>

      <section id="reviews">
        <h2>8. Reviews</h2>
        <ul>
          <li>
            Only a client with a completed booking can review that vendor, and
            only once for each booking.
          </li>
          <li>
            A review is the client’s own opinion. It is not Eventtz’s opinion.
          </li>
          <li>
            Reviews must be honest. Fake reviews, reviews written by the vendor,
            and reviews given in return for a reward are not allowed.
          </li>
          <li>
            Vendors must not punish a client for a review, offer anything to get
            a review changed or removed, or write a clause into a contract that
            stops clients reviewing.
          </li>
          <li>
            A vendor may be offered one calm, factual reply to a review.
          </li>
          <li>
            We hide a review only if it is against the law, abusive, fake or not
            about the booking. We do not remove reviews just because a vendor
            does not like them.
          </li>
        </ul>
      </section>

      <section id="vendor-responsibilities">
        <h2>9. Rules for vendors</h2>
        <p>If you are a vendor, you agree to:</p>
        <ul>
          <li>describe your services, prices and availability truthfully;</li>
          <li>do the work you agreed to do, properly and within the law;</li>
          <li>reply to booking requests and messages honestly;</li>
          <li>confirm on Eventtz when a booked event has happened, so you can be paid;</li>
          <li>
            choose a cancellation policy (Flexible, Moderate or Strict) and stick
            to it. The policy shown when the client paid is the one that applies;
          </li>
          <li>
            accept that if you cancel a paid booking yourself, the client gets all
            their money back, whatever your policy says;
          </li>
          <li>
            take payment through Eventtz for any booking that started on
            Eventtz, and not ask the client to pay you another way;
          </li>
          <li>
            not hand the job to someone else unless the client agrees first in
            Messages. You stay responsible for the work either way;
          </li>
          <li>
            look after the client’s property and venue, and put right any damage
            you cause.
          </li>
        </ul>
        <p>
          More rules for vendors (listing, insurance, complaints, warnings and
          ending an account) are in the{" "}
          <a href="#vendor-terms">next section</a>.
        </p>
      </section>

      <section id="vendor-terms">
        <h2>10. Extra terms for vendors</h2>
        <p>
          Vendors are businesses, so these extra points protect you too.
        </p>

        <h3>Licences, insurance and food safety</h3>
        <ul>
          <li>
            You must hold the licences and cover that the law, and the venue you
            work at, require. We cannot list a vendor who does not.
          </li>
          <li>
            We suggest you also hold public liability insurance (cover for harm
            or damage you cause by accident). If you upload your policy, we show
            a badge on your profile.
          </li>
          <li>
            If you provide food, you must be registered as a food business and
            hold a food hygiene certificate. You must give correct allergen
            information.
          </li>
          <li>
            We only ask to see your papers if there is a complaint about you.
            If a licence or certificate the law requires runs out, we give you
            time to fix it before we suspend your listing.
          </li>
        </ul>

        <h3>Cancellations by vendors</h3>
        <ul>
          <li>
            If you cancel a paid booking, the client is refunded in full. This
            refund, including the service fee, is never taken from your other
            earnings.
          </li>
          <li>
            We keep a private record of cancellations you make. Clients cannot
            see it.
          </li>
          <li>
            If you cancel {policy.vendorCancellationReviewCount} or more paid
            bookings within {policy.vendorCancellationReviewDays} days, a member
            of staff looks at what happened. We may then send you a warning. We
            take no further action without a warning first.
          </li>
          <li>
            Cancellations for exceptional circumstances (section 4) never count
            against you. Neither does refusing to work in unsafe conditions (see
            section 11).
          </li>
        </ul>

        <h3>Keeping bookings on Eventtz</h3>
        {/* ASSUMPTION: awaiting solicitor – circumvention clause wording (plan 1E): "originated on the Platform", mutual with clients, first breach a written warning. */}
        <ul>
          <li>
            If you met a client on Eventtz, you both agree to book and pay
            through Eventtz for {policy.circumventionMonths} months from the
            day you were introduced. This goes for the client as well as the
            vendor.
          </li>
          <li>
            We count someone as met on Eventtz if the first contact between you
            was through a request, quote or message on the Platform.
          </li>
          <li>
            A first breach gets a written warning. A repeat breach can lead to
            suspension.
          </li>
        </ul>

        <h3>Warnings, listing pauses and ending an account</h3>
        <ul>
          <li>
            We may hide your listing, suspend you or end your account for:
            fraud; a legally required licence that has run out; repeated
            cancellations without a good reason; putting people’s safety at
            risk; breaking the law; or breaking these Terms.
          </li>
          <li>
            Whenever we hide your listing, suspend or ban you, we tell you why,
            by email and in your account.
          </li>
          <li>
            If the problem can be fixed, we give you a warning and a chance to
            fix it first. A short listing pause comes before anything harsher.
          </li>
          <li>
            If we end your account, we give you {policy.vendorTerminationNoticeDays}{" "}
            days’ notice and our reasons. We may act at once only where the law,
            or stopping fraud or danger, makes that necessary.
          </li>
          <li>
            Bookings already paid are still honoured, and money you have earned
            is still paid out, unless it is held for a dispute or a chargeback.
          </li>
        </ul>

        <h3>How vendors are ranked in search</h3>
        <p>
          When a client searches, we read what they typed and work out the
          services and needs they mean. We then show the vendors that best match.
          Clients can sort by price or by rating. Only approved vendors who have
          finished payout set-up are listed. Nobody can pay to be placed higher.
        </p>

        <h3>Complaints from vendors</h3>
        {/* ASSUMPTION: awaiting solicitor – Q4: are we a small enterprise for P2B Articles 11 and 12 (complaints system and named mediators)? Default: we run a complaints route anyway and name no mediators. */}
        <p>
          If you are unhappy with a decision, email{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          We reply to say we have it within {policy.complaintAcknowledgeWorkingDays}{" "}
          working days. We give you a full answer within{" "}
          {policy.complaintReplyDays} days.
        </p>

        <h3>Vendor information</h3>
        <p>
          We hold the details you give us, such as your business details,
          listing, prices and bank set-up (held by Stripe). Clients see your
          public listing. Your contact details are shared with a client only
          after they have paid. Our{" "}
          <Link href="/compliances/privacy-policy">Privacy Policy</Link>{" "}
          explains more.
        </p>
      </section>

      <section id="client-responsibilities">
        <h2>11. Rules for clients</h2>
        <p>If you are a client, you agree to:</p>
        <ul>
          <li>give true and complete event details when you ask for a booking;</li>
          <li>treat vendors with respect;</li>
          <li>pay for bookings through Eventtz;</li>
          <li>
            after the event, confirm it went ahead, or report any problem
            quickly;
          </li>
          <li>
            pay for damage your guests cause to a vendor’s equipment.
          </li>
        </ul>

        <h3>On the day</h3>
        <p>So the vendor can do a good job, please make sure:</p>
        <ul>
          <li>the vendor can get in, park and set up on time;</li>
          <li>there is power and space where the vendor needs it;</li>
          <li>the place is safe to work in;</li>
          <li>the guest numbers and food needs (such as allergies) you gave are right;</li>
          <li>
            the venue allows the music, catering or equipment you booked.
          </li>
        </ul>
        <p>
          A vendor who leaves, or refuses to start, because the place is unsafe
          is not cancelling. Their cancellation record is not affected.
        </p>
        <p>
          If you ask for extras on the day, agree the price on Eventtz first so
          it can be paid through the booking. Anything agreed outside Eventtz is
          at your own risk and we cannot help with it.
        </p>
      </section>

      <section id="content">
        <h2>12. Your photos, words and other content</h2>
        <p>
          Anything you upload, such as photos, descriptions or reviews, stays
          yours. You give us permission to store it, show it on Eventtz and use
          it to promote Eventtz. You can still use it anywhere else you like.
          The Eventtz name, logo, website and software belong to us.
        </p>
        <p>
          Our staff may read the Messages on a booking when they need to, to
          settle a dispute or to keep people safe.
        </p>
      </section>

      <section id="prohibited-conduct">
        <h2>13. Things you must not do</h2>
        <ul>
          <li>Break the law, cheat anyone, or use Eventtz to hurt anyone.</li>
          <li>Harass, threaten or discriminate against anyone, or put anyone in danger.</li>
          <li>
            Copy large amounts of the website by automatic means, try to take our
            software apart, or try to break or overload the website.
          </li>
          <li>Upload viruses, or anything you do not have the right to share.</li>
          <li>Pretend to be someone else, or lie about who you work for.</li>
        </ul>
      </section>

      <section id="disputes">
        <h2>14. If something goes wrong</h2>
        <ul>
          <li>
            The client or the vendor can report a problem from the booking page.
          </li>
          <li>
            To stop the vendor being paid while we look into it, report the
            problem before the reporting time runs out: {defaultReportHours}{" "}
            hours after the event ends, or longer for some services (see
            section 5).
          </li>
          <li>
            While a report is open, we will not pay the vendor until it is
            settled.
          </li>
          <li>
            The agreement for the event service is between the client and the
            vendor. Eventtz is not part of that agreement, but we will help you
            sort the problem out.
          </li>
          <li>
            We make our decisions fairly and honestly. Our decision does not take
            away your right to go to court or use any other legal route.
          </li>
        </ul>
      </section>

      <section id="disclaimers">
        <h2>15. What we cannot promise</h2>
        <p>
          We provide Eventtz as it is. We cannot promise the website will always
          work without breaks or errors. We cannot promise every vendor will do
          exactly what you hoped. Our{" "}
          <Link href="/compliances/legal-disclaimer">Legal Disclaimer</Link> has
          more detail.
        </p>
      </section>

      <section id="liability">
        <h2>16. Limits on what we are responsible for</h2>
        {/* ASSUMPTION: awaiting solicitor – Q5: liability cap figure and wording, and the claims time limit. Default: greater of fees paid in the last 12 months or £100; claims within 24 months. */}
        <ul>
          <li>
            As far as the law allows, we are not responsible for knock-on losses
            that come from using Eventtz or from a vendor’s service. These are
            losses that do not follow directly from what went wrong, such as lost
            income or a lost opportunity.
          </li>
          <li>
            Our total responsibility to you for anything connected to Eventtz is
            limited to the larger of: the fees you paid Eventtz in the{" "}
            {policy.liabilityCapMonthsOfFees} months before the problem, or{" "}
            {pounds(policy.liabilityCapMinimumGbp)}.
          </li>
          <li>
            This limit does <strong>not</strong> cover death or injury caused by
            our carelessness, fraud, or anything else the law says cannot be
            limited.
          </li>
          <li>
            If a vendor’s service leads to a claim against Eventtz, for example
            someone is hurt by the vendor’s food, the vendor pays for that claim
            and our costs of dealing with it.
          </li>
          <li>
            If you want to make a claim against us, you must do so within{" "}
            {policy.claimsTimeLimitMonths} months of the problem.
          </li>
        </ul>
      </section>

      <section id="termination">
        <h2>17. Closing your account</h2>
        <ul>
          <li>You can stop using Eventtz at any time.</li>
          <li>
            Clients and vendors can delete their account from Settings. We then
            turn off your login and remove your personal details.
          </li>
          <li>
            The law requires us to keep booking and payment records. We keep
            those without your name, email or phone number.
          </li>
          <li>
            You cannot delete your account while any of these are true: a payment
            is still going through, you have an accepted booking that has not
            happened yet, or a problem report is open.
          </li>
          <li>
            We may pause or close an account when we need to, to keep people
            safe, to follow the law, or because these rules were broken.
            Vendors get warning, reasons and notice as set out in section 10.
          </li>
        </ul>

        <h3>Money held for a vendor who has not finished set-up</h3>
        {/* ASSUMPTION: awaiting solicitor – Q6: treatment of held vendor shares never claimed. Default: we contact the vendor, and after the period below with no set-up, may refund the client. */}
        <p>
          If a vendor’s share is held because they have not finished their Stripe
          set-up, it is paid out as soon as they finish. If they have not
          finished after {policy.unclaimedVendorShareMonths} months, we contact
          them. If we still hear nothing, we may refund the client instead.
        </p>
      </section>

      <section id="changes-to-terms">
        <h2>18. Changes to these Terms</h2>
        <ul>
          <li>
            We may change these Terms. Clients get reasonable notice by email.
          </li>
          <li>
            Vendors get at least {policy.vendorTermsChangeNoticeDays} days’
            notice by email before a change starts. A vendor who does not agree
            can close their account before the change starts.
          </li>
          <li>
            Each version has an effective date. Older versions stay on the
            website. You can read the previous one{" "}
            <Link href={`/compliances/terms-of-service/${policy.previousTermsVersion}`}>
              here
            </Link>
            .
          </li>
          <li>
            You may be asked to accept the new version the next time you sign
            in, before you can book or accept a booking.
          </li>
        </ul>
      </section>

      <section id="governing-law">
        <h2>19. Which law applies</h2>
        <p>
          These rules are under the law of England and Wales. Any court case
          about them will be heard in the courts of England and Wales. If you are
          using Eventtz as a private person, you keep any legal protections you
          have where you live.
        </p>
      </section>

      <section id="contact">
        <h2>20. Contact us</h2>
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
