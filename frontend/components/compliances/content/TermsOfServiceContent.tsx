import Link from "next/link";
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";
import {
  FOOTER_ADDRESS_LINES,
  FOOTER_CONTACT_EMAIL,
} from "@/lib/footerLinks";

export function TermsOfServiceContent() {
  const serviceFeePercent = getBookingServiceFeePercent();

  return (
    <>
      <h1>Terms of Service</h1>
      <p className="compliance-meta">
        Effective date: 1 July 2026
        <br />
        Last updated: 11 July 2026
      </p>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use
        of Eventtz, operated by Four Integers Ltd (&quot;Four Integers&quot;,
        &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By creating an
        account or using the Platform, you agree to these Terms.
      </p>

      <section id="the-platform">
        <h2>1. The Platform</h2>
        <p>
          Eventtz is an online marketplace that helps clients discover, message,
          and book African event vendors in the UK. Four Integers provides the
          technology and payment infrastructure; vendors remain independent
          service providers responsible for delivering their services.
        </p>
      </section>

      <section id="accounts">
        <h2>2. Accounts</h2>
        <p>
          You must provide accurate information and keep your credentials
          secure. You are responsible for activity under your account. We may
          suspend or terminate accounts that violate these Terms, applicable
          law, or platform policies.
        </p>
      </section>

      <section id="bookings-payments">
        <h2>3. Bookings and payments</h2>
        <ul>
          <li>
            Booking requests, confirmations, cancellations, and refunds follow
            the terms shown at checkout and any vendor-specific policies
            disclosed on the listing.
          </li>
          <li>
            Payments are processed by Stripe. By paying through Eventtz, you also
            agree to Stripe&apos;s applicable terms.
          </li>
          <li>
            A platform service fee of {serviceFeePercent}% may apply to client
            bookings, as displayed before payment.
          </li>
          <li>
            Vendor payouts are handled through Stripe Connect subject to
            verification and compliance checks.
          </li>
        </ul>
      </section>

      <section id="vendor-responsibilities">
        <h2>4. Vendor responsibilities</h2>
        <p>Vendors agree to:</p>
        <ul>
          <li>provide accurate listings, pricing, and availability;</li>
          <li>deliver services professionally and lawfully;</li>
          <li>maintain required licences, insurance, and food/hygiene compliance where applicable;</li>
          <li>respond to booking requests and messages in good faith;</li>
          <li>not circumvent Eventtz payments for bookings originated on the Platform.</li>
        </ul>
      </section>

      <section id="client-responsibilities">
        <h2>5. Client responsibilities</h2>
        <p>Clients agree to:</p>
        <ul>
          <li>provide accurate event details when requesting bookings;</li>
          <li>communicate respectfully with vendors;</li>
          <li>pay agreed amounts through the Platform where required;</li>
          <li>honour reasonable cancellation terms disclosed before booking.</li>
        </ul>
      </section>

      <section id="content">
        <h2>6. Content and intellectual property</h2>
        <p>
          You retain ownership of content you upload but grant Four Integers a
          non-exclusive licence to host, display, and promote that content on
          Eventtz. Platform branding, software, and design remain our property.
        </p>
      </section>

      <section id="prohibited-conduct">
        <h2>7. Prohibited conduct</h2>
        <p>You must not:</p>
        <ul>
          <li>use the Platform for unlawful, fraudulent, or abusive activity;</li>
          <li>harass, discriminate against, or endanger other users;</li>
          <li>scrape, reverse engineer, or disrupt the Platform;</li>
          <li>upload malware or infringing material;</li>
          <li>misrepresent your identity or affiliation.</li>
        </ul>
      </section>

      <section id="disputes">
        <h2>8. Disputes</h2>
        <p>
          We may offer tools to help resolve booking disputes but are not a
          party to the underlying service contract between client and vendor.
          Our decisions in platform dispute processes are made in good faith and
          do not replace your legal remedies.
        </p>
      </section>

      <section id="disclaimers">
        <h2>9. Disclaimers</h2>
        <p>
          The Platform is provided &quot;as is&quot; and &quot;as available&quot;.
          We do not guarantee uninterrupted access or that every vendor will meet
          your expectations. See our{" "}
          <Link href="/compliances/legal-disclaimer">Legal Disclaimer</Link> for
          additional information.
        </p>
      </section>

      <section id="liability">
        <h2>10. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Four Integers is not liable
          for indirect, incidental, or consequential losses arising from your
          use of Eventtz or vendor services. Nothing in these Terms limits
          liability that cannot be limited under applicable law.
        </p>
      </section>

      <section id="termination">
        <h2>11. Termination</h2>
        <p>
          You may stop using Eventtz at any time. We may suspend or terminate
          access where necessary to protect users, comply with law, or enforce
          these Terms.
        </p>
      </section>

      <section id="governing-law">
        <h2>12. Governing law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Courts in
          England and Wales have exclusive jurisdiction, subject to mandatory
          consumer protections that apply in your country of residence.
        </p>
      </section>

      <section id="contact">
        <h2>13. Contact</h2>
        <p>
          Four Integers Ltd, {FOOTER_ADDRESS_LINES.join(", ")}.
          <br />
          Email:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>
        </p>
      </section>
    </>
  );
}
