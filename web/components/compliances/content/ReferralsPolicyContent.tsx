import Link from "next/link";
import policy from "@/lib/policyConstants.json";
import { REFERRAL_FEE_TIERS } from "@/lib/bookingServiceFee";
import { FOOTER_COMPANY_NAME, FOOTER_CONTACT_EMAIL } from "@/lib/footerLinks";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

/**
 * The Referral Policy page, written in plain English.
 *
 * The client savings are read from `bookingServiceFee.ts` so the page always
 * matches what checkout charges.
 */
export function ReferralsPolicyContent() {
  const referralTiersLowestFirst = [...REFERRAL_FEE_TIERS].reverse();
  const [year, month, day] = policy.termsVersion.split("-").map(Number);
  const effectiveDate = `${day} ${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <>
      <h1>Referral Policy</h1>
      <p className="compliance-meta">
        Effective date: {effectiveDate}
        <br />
        Last updated: 17 October 2026
      </p>
      <p>
        This policy explains how referral offers work on Eventtz. A referral is
        when someone invites another person to use Eventtz. Referral offers are
        run by {FOOTER_COMPANY_NAME}. We may limit, pause or change them at any
        time.
      </p>

      <section id="vendor-client-referrals">
        <h2>1. Vendor referral links for clients</h2>
        <p>
          Vendors can share their own referral link or code with clients. If a
          client books that vendor through it, the client saves money off the
          Eventtz service fee:
        </p>
        <ul>
          {referralTiersLowestFirst.map((tier) => (
            <li key={tier.minSpendGbp}>
              £{tier.feeDiscountGbp} off when the vendor’s price is £
              {tier.minSpendGbp} or more
            </li>
          ))}
        </ul>
        <p>
          The saving comes off the Eventtz fee only. It never reduces what the
          vendor is paid. You see the saving before you pay. The service fee
          itself is explained in the{" "}
          <Link href="/compliances/terms-of-service#fees-taxes">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      <section id="overview">
        <h2>2. Other referral offers</h2>
        <p>
          Sometimes Eventtz may reward people for inviting new clients or vendors.
          When an offer is running, the reward, who can take part and when it
          ends are shown in the invitation or on the offer page.
        </p>
      </section>

      <section id="eligibility">
        <h2>3. Who can take part</h2>
        <ul>
          <li>You must have an Eventtz account that is open and not suspended.</li>
          <li>
            The person you invite must be new to Eventtz and must sign up using
            your official referral link or code.
          </li>
          <li>
            You cannot refer yourself, use more than one account, or cheat the
            offer in any way. This includes inviting your own family members or
            businesses just to claim a reward, or making fake bookings.
          </li>
          <li>
            Some offers may only be open to people in certain places, to certain
            account types, or to people who have made a certain number of
            bookings.
          </li>
        </ul>
      </section>

      <section id="rewards">
        <h2>4. Rewards</h2>
        <p>
          A reward may be account credit, money off fees, or something else
          described in the offer. You only get the reward once the conditions
          are met, for example when the vendor you invited finishes setting up
          their profile, or the client you invited completes their first
          booking.
        </p>
      </section>

      <section id="changes">
        <h2>5. Changing or ending an offer</h2>
        <p>
          We may change, pause or end any referral offer without warning. If you
          have already been given a reward under the old rules, you keep it,
          unless we find cheating or misuse. If we find cheating, we may take
          back a reward and close the accounts involved.
        </p>
      </section>

      <section id="taxes">
        <h2>6. Tax</h2>
        <p>
          If a reward means you owe tax where you live, paying it is your
          responsibility.
        </p>
      </section>

      <section id="contact">
        <h2>7. Contact us</h2>
        <p>
          Questions about referrals:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          See also our{" "}
          <Link href="/compliances/terms-of-service">Terms of Service</Link>.
        </p>
      </section>
    </>
  );
}
