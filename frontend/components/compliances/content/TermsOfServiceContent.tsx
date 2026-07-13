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
        Last updated: 13 July 2026
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
            When you pay for a booking, we keep your payment safe until the
            event is done. The vendor is not paid straight away at checkout.
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

      <section id="cancellations-refunds">
        <h2>4. Cancellations and refunds</h2>
        <ul>
          <li>
            You can cancel a booking from your bookings page at any time before
            the vendor is paid. If you haven&apos;t paid yet, nothing is charged.
          </li>
          <li>
            If you cancel after paying — or the vendor cancels — you get a full
            refund to your original payment method. Refunds usually take 5-10
            working days to arrive.
          </li>
          <li>
            Once the vendor has been paid, the booking can no longer be
            cancelled on the Platform. If something went wrong, use the
            problem-reporting (dispute) option on the booking instead.
          </li>
          <li>
            While a reported problem is being looked into, cancellation isn&apos;t
            available until it&apos;s resolved.
          </li>
        </ul>
      </section>

      <section id="event-completion-payouts">
        <h2>5. After the event: confirming completion and vendor payment</h2>
        <ul>
          <li>
            After the event, both the client and the vendor are asked to confirm
            it went well. Once both confirm, the vendor is paid.
          </li>
          <li>
            If neither side confirms within 48 hours after the event — and no
            problem has been reported — we pay the vendor automatically.
          </li>
          <li>
            If something went wrong, report it from your booking before that
            48-hour window closes. We pause any payment to the vendor while we
            look into it.
          </li>
        </ul>
      </section>

      <section id="vendor-responsibilities">
        <h2>6. Vendor responsibilities</h2>
        <p>Vendors agree to:</p>
        <ul>
          <li>provide accurate listings, pricing, and availability;</li>
          <li>deliver services professionally and lawfully;</li>
          <li>maintain required licences, insurance, and food/hygiene compliance where applicable;</li>
          <li>respond to booking requests and messages in good faith;</li>
          <li>confirm when a booked event is done so payment can be released;</li>
          <li>
            understand that cancelling a paid booking refunds the client in
            full;
          </li>
          <li>not circumvent Eventtz payments for bookings originated on the Platform.</li>
        </ul>
      </section>

      <section id="client-responsibilities">
        <h2>7. Client responsibilities</h2>
        <p>Clients agree to:</p>
        <ul>
          <li>provide accurate event details when requesting bookings;</li>
          <li>communicate respectfully with vendors;</li>
          <li>pay agreed amounts through the Platform where required;</li>
          <li>
            after the event, confirm it went well — or report any problems
            promptly.
          </li>
        </ul>
      </section>

      <section id="content">
        <h2>8. Content and intellectual property</h2>
        <p>
          You retain ownership of content you upload but grant Four Integers a
          non-exclusive licence to host, display, and promote that content on
          Eventtz. Platform branding, software, and design remain our property.
        </p>
      </section>

      <section id="prohibited-conduct">
        <h2>9. Prohibited conduct</h2>
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
        <h2>10. Disputes</h2>
        <p>
          Either side can report a problem from the booking page. While a
          report is open we pause any payment to the vendor until it&apos;s
          resolved. We may offer tools to help resolve booking disputes but are
          not a party to the underlying service contract between client and
          vendor. Our decisions in platform dispute processes are made in good
          faith and do not replace your legal remedies.
        </p>
      </section>

      <section id="disclaimers">
        <h2>11. Disclaimers</h2>
        <p>
          The Platform is provided &quot;as is&quot; and &quot;as available&quot;.
          We do not guarantee uninterrupted access or that every vendor will meet
          your expectations. See our{" "}
          <Link href="/compliances/legal-disclaimer">Legal Disclaimer</Link> for
          additional information.
        </p>
      </section>

      <section id="liability">
        <h2>12. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Four Integers is not liable
          for indirect, incidental, or consequential losses arising from your
          use of Eventtz or vendor services. Nothing in these Terms limits
          liability that cannot be limited under applicable law.
        </p>
      </section>

      <section id="termination">
        <h2>13. Termination</h2>
        <p>
          You may stop using Eventtz at any time. We may suspend or terminate
          access where necessary to protect users, comply with law, or enforce
          these Terms.
        </p>
      </section>

      <section id="governing-law">
        <h2>14. Governing law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Courts in
          England and Wales have exclusive jurisdiction, subject to mandatory
          consumer protections that apply in your country of residence.
        </p>
      </section>

      <section id="contact">
        <h2>15. Contact</h2>
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
