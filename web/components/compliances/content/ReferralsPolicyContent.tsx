import Link from "next/link";
import { FOOTER_COMPANY_NAME, FOOTER_CONTACT_EMAIL } from "@/lib/footerLinks";

export function ReferralsPolicyContent() {
  return (
    <>
      <h1>Referral Policy</h1>
      <p className="compliance-meta">
        Effective date: 1 July 2026
        <br />
        Last updated: 11 July 2026
      </p>
      <p>
        This Referral Policy describes how referral or invite programmes may
        operate on Eventtz when offered by {FOOTER_COMPANY_NAME}. Programmes may be
        limited, paused, or changed at any time.
      </p>

      <section id="overview">
        <h2>1. Overview</h2>
        <p>
          From time to time, Eventtz may run referral incentives that reward
          existing users for inviting new clients or vendors to the Platform.
          When active, specific reward amounts, eligibility rules, and expiry
          dates will be shown in the referral invitation or promotion page.
        </p>
      </section>

      <section id="eligibility">
        <h2>2. Eligibility</h2>
        <ul>
          <li>Participants must have an active Eventtz account in good standing.</li>
          <li>Referred users must be new to Eventtz and sign up via the official referral link or code.</li>
          <li>Self-referrals, duplicate accounts, or fraudulent activity are not permitted.</li>
          <li>Some promotions may be limited by geography, account type, or booking volume.</li>
        </ul>
      </section>

      <section id="rewards">
        <h2>3. Rewards</h2>
        <p>
          Rewards may take the form of account credits, fee discounts, or other
          benefits described in the active promotion. Rewards are issued only
          after qualifying conditions are met (for example, a referred vendor
          completing onboarding or a referred client completing a first booking).
        </p>
      </section>

      <section id="changes">
        <h2>4. Changes and termination</h2>
        <p>
          We may modify, suspend, or end any referral programme without prior
          notice. Changes do not affect rewards already issued in accordance
          with the terms that applied when the qualifying action occurred, unless
          fraud or abuse is detected.
        </p>
      </section>

      <section id="taxes">
        <h2>5. Taxes</h2>
        <p>
          Participants are responsible for any tax implications of referral
          rewards in their jurisdiction.
        </p>
      </section>

      <section id="contact">
        <h2>6. Contact</h2>
        <p>
          Questions about referrals:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          General platform terms:{" "}
          <Link href="/compliances/terms-of-service">Terms of Service</Link>.
        </p>
      </section>
    </>
  );
}
