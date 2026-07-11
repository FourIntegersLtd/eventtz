import Link from "next/link";
import { FOOTER_CONTACT_EMAIL } from "@/lib/footerLinks";

export function LegalDisclaimerContent() {
  return (
    <>
      <h1>Legal Disclaimer</h1>
      <p className="compliance-meta">
        Effective date: 1 July 2026
        <br />
        Last updated: 11 July 2026
      </p>
      <p>
        The information on Eventtz is provided for general marketplace purposes
        only. By using the Platform, you acknowledge the following:
      </p>

      <section id="marketplace-role">
        <h2>1. Marketplace role</h2>
        <p>
          Four Integers Ltd operates Eventtz as a technology platform connecting
          clients and independent vendors. We are not the employer of vendors and
          are not a party to the service contract formed when a booking is
          confirmed between a client and a vendor.
        </p>
      </section>

      <section id="vendor-services">
        <h2>2. Vendor services</h2>
        <p>
          Vendors are solely responsible for the quality, safety, legality, and
          delivery of their services, including food handling, staffing,
          equipment, and compliance with local regulations. Listings, reviews,
          and badges are informational and do not constitute endorsements or
          guarantees by Four Integers.
        </p>
      </section>

      <section id="no-professional-advice">
        <h2>3. No professional advice</h2>
        <p>
          Content on Eventtz does not constitute legal, financial, health, or
          event-planning advice. You should obtain independent professional
          advice where appropriate.
        </p>
      </section>

      <section id="accuracy">
        <h2>4. Accuracy of information</h2>
        <p>
          We strive to keep platform information accurate but do not warrant
          that listings, pricing, availability, or third-party content are
          complete, current, or error-free. Vendors may update offerings at any
          time.
        </p>
      </section>

      <section id="ai-features">
        <h2>5. AI-assisted features</h2>
        <p>
          Optional AI tools (such as vendor onboarding suggestions) generate
          draft content that must be reviewed by the vendor before publication.
          AI outputs may be incomplete or inaccurate and should not be relied on
          without human review.
        </p>
      </section>

      <section id="external-links">
        <h2>6. External links</h2>
        <p>
          Eventtz may link to third-party websites or social profiles. We are
          not responsible for their content, policies, or practices.
        </p>
      </section>

      <section id="limitation">
        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Four Integers Ltd excludes
          liability for losses arising from vendor services, event outcomes, or
          reliance on Platform content. Nothing in this disclaimer limits
          liability that cannot be excluded under applicable law.
        </p>
      </section>

      <section id="contact">
        <h2>8. Contact</h2>
        <p>
          Questions:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          See our{" "}
          <Link href="/compliances/terms-of-service">Terms of Service</Link>.
        </p>
      </section>
    </>
  );
}
