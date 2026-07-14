import Link from "next/link";
import { ThirdPartyServicesTable } from "@/components/compliances/content/ThirdPartyServicesTable";
import {
  FOOTER_ADDRESS_LINES,
  FOOTER_CONTACT_EMAIL,
  FOOTER_PRIVACY_EMAIL,
} from "@/lib/footerLinks";

export function PrivacyPolicyContent() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="compliance-meta">
        Effective date: 1 July 2026
        <br />
        Last updated: 14 July 2026
      </p>
      <p>
        Eventtz (&quot;Eventtz&quot;, &quot;we&quot;, &quot;us&quot;, or
        &quot;our&quot;) is a UK marketplace that connects clients with African
        event vendors. This Privacy Policy explains how Four Integers Ltd
        (&quot;Four Integers&quot;), the operator of Eventtz, collects, uses,
        stores, and protects personal data when you use our website, mobile
        experiences, and related services (collectively, the &quot;Platform&quot;).
      </p>

      <section id="data-controller">
        <h2>1. Data controller</h2>
        <p>
          Four Integers Ltd is the data controller for personal data processed
          through Eventtz.
        </p>
        <ul>
          <li>
            <strong>Company:</strong> Four Integers Ltd
          </li>
          <li>
            <strong>Address:</strong> {FOOTER_ADDRESS_LINES.join(", ")}
          </li>
          <li>
            <strong>Email:</strong>{" "}
            <a href={`mailto:${FOOTER_PRIVACY_EMAIL}`}>{FOOTER_PRIVACY_EMAIL}</a>
          </li>
        </ul>
      </section>

      <section id="data-we-collect">
        <h2>2. Data we collect</h2>
        <h3>Account and profile data</h3>
        <p>
          When you register, we collect information such as your name, email
          address, phone number (where provided), account type (client or
          vendor), and profile details you choose to add.
        </p>
        <h3>Vendor and listing data</h3>
        <p>
          Vendors may provide business names, service descriptions, pricing,
          availability, photos, portfolio media, location or service-area
          information, and verification documents where required.
        </p>
        <h3>Booking and transaction data</h3>
        <p>
          When you request or manage bookings, we process event details, dates,
          messages between parties, booking status, and payment-related metadata.
          Card payments are processed by Stripe; we do not store full card
          numbers on our servers.
        </p>
        <h3>Communications</h3>
        <p>
          We process messages sent through Eventtz chat, support enquiries, and
          notification preferences you set in your account.
        </p>
        <h3>Technical and usage data</h3>
        <p>
          We automatically collect device and browser information, IP address,
          log data, cookies, and usage analytics needed to operate, secure, and
          improve the Platform.
        </p>
      </section>

      <section id="how-we-use-data">
        <h2>3. How we use your data</h2>
        <p>We use personal data to:</p>
        <ul>
          <li>create and manage accounts;</li>
          <li>match clients with vendors and facilitate bookings;</li>
          <li>process payments and payouts through Stripe;</li>
          <li>send service, booking, and security notifications;</li>
          <li>provide customer support and resolve disputes;</li>
          <li>improve listings, search, and platform safety;</li>
          <li>comply with legal, tax, and regulatory obligations.</li>
        </ul>
        <p>
          Where vendors use optional AI-assisted onboarding tools, relevant
          profile text or image metadata may be sent to OpenAI solely to
          generate suggestions. You can review and edit outputs before
          publishing.
        </p>
      </section>

      <section id="legal-bases">
        <h2>4. Legal bases (UK GDPR)</h2>
        <p>Depending on the activity, we rely on:</p>
        <ul>
          <li>
            <strong>Contract:</strong> to provide the Platform and fulfil
            bookings;
          </li>
          <li>
            <strong>Legitimate interests:</strong> to secure the Platform,
            prevent fraud, and improve services, balanced against your rights;
          </li>
          <li>
            <strong>Consent:</strong> for optional marketing or non-essential
            cookies where required;
          </li>
          <li>
            <strong>Legal obligation:</strong> for record-keeping, tax, and
            compliance.
          </li>
        </ul>
      </section>

      <section id="third-party-services">
        <h2>5. Third-party services</h2>
        <p>
          We use trusted processors to run Eventtz. Each provider only receives
          data needed for its function and is bound by contractual safeguards
          where applicable.
        </p>
        <ThirdPartyServicesTable />
        <p>
          Stripe&apos;s privacy practices are described at{" "}
          <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer">
            stripe.com/gb/privacy
          </a>
          . Supabase privacy information is available at{" "}
          <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
            supabase.com/privacy
          </a>
          .
        </p>
      </section>

      <section id="international-transfers">
        <h2>6. International transfers</h2>
        <p>
          Some providers process data outside the UK. Where this occurs, we use
          appropriate safeguards such as UK International Data Transfer
          Agreements, adequacy regulations, or equivalent contractual protections.
        </p>
      </section>

      <section id="retention">
        <h2>7. Data retention</h2>
        <p>
          We retain personal data for as long as your account is active and as
          needed to provide services, resolve disputes, enforce agreements, and
          meet legal obligations. Booking and financial records may be kept for
          longer where required by law.
        </p>
      </section>

      <section id="your-rights">
        <h2>8. Your rights</h2>
        <p>Under UK data protection law, you may have the right to:</p>
        <ul>
          <li>access a copy of your personal data;</li>
          <li>rectify inaccurate data;</li>
          <li>erase data in certain circumstances;</li>
          <li>restrict or object to processing;</li>
          <li>data portability where applicable;</li>
          <li>withdraw consent where processing is consent-based;</li>
          <li>lodge a complaint with the ICO (ico.org.uk).</li>
        </ul>
        <p>
          To exercise your rights, contact{" "}
          <a href={`mailto:${FOOTER_PRIVACY_EMAIL}`}>{FOOTER_PRIVACY_EMAIL}</a>.
        </p>
      </section>

      <section id="security">
        <h2>9. Security</h2>
        <p>
          We apply technical and organisational measures including access
          controls, encryption in transit, and role-based permissions. No online
          service can guarantee absolute security; please use a strong password
          and keep login details confidential.
        </p>
      </section>

      <section id="children">
        <h2>10. Children</h2>
        <p>
          Eventtz is not directed at children under 18. We do not knowingly
          collect personal data from children.
        </p>
      </section>

      <section id="changes">
        <h2>11. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be posted on this page with an updated &quot;Last updated&quot;
          date. Continued use of the Platform after changes constitutes
          acceptance of the revised policy.
        </p>
      </section>

      <section id="contact">
        <h2>12. Contact</h2>
        <p>
          Questions about this Privacy Policy or your data can be sent to{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          Related policies:{" "}
          <Link href="/compliances/cookies-policy">Cookie Policy</Link>,{" "}
          <Link href="/compliances/terms-of-service">Terms of Service</Link>.
        </p>
      </section>
    </>
  );
}
