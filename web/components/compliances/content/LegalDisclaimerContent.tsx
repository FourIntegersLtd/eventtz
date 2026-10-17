import Link from "next/link";
import policy from "@/lib/policyConstants.json";
import { FOOTER_COMPANY_NAME, FOOTER_CONTACT_EMAIL } from "@/lib/footerLinks";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

/** The Legal Disclaimer page, written in plain English. */
export function LegalDisclaimerContent() {
  const [year, month, day] = policy.termsVersion.split("-").map(Number);
  const effectiveDate = `${day} ${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <>
      <h1>Legal Disclaimer</h1>
      <p className="compliance-meta">
        Effective date: {effectiveDate}
        <br />
        Last updated: 17 October 2026
      </p>
      <p>
        This page explains what Eventtz is responsible for, and what it is not.
        By using Eventtz, you accept the points below.
      </p>

      <section id="marketplace-role">
        <h2>1. What Eventtz does</h2>
        <p>
          {FOOTER_COMPANY_NAME} runs Eventtz, a website that puts clients in
          touch with event vendors. Vendors are their own businesses. They do not
          work for us. When a client and a vendor agree a booking, the agreement
          for the event service is between them. Eventtz is not part of that
          agreement.
        </p>
      </section>

      <section id="vendor-services">
        <h2>2. Vendors are responsible for their work</h2>
        <p>
          Each vendor is responsible for the quality and safety of their service,
          for doing it legally, and for turning up and delivering it. This
          includes handling food safely, their staff, their equipment, and
          following local rules. Listings, reviews and badges on Eventtz are
          there to help you choose. They are not a promise or a recommendation
          from Eventtz.
        </p>
      </section>

      <section id="no-professional-advice">
        <h2>3. We do not give professional advice</h2>
        <p>
          Nothing on Eventtz is legal, money, health or event-planning advice.
          If you need that kind of advice, ask a qualified professional.
        </p>
      </section>

      <section id="accuracy">
        <h2>4. Information on the website</h2>
        <p>
          We try to keep everything on Eventtz correct, but we cannot promise
          that listings, prices, availability or information from other
          companies are complete, up to date or free of mistakes. Vendors can
          change what they offer at any time.
        </p>
      </section>

      <section id="ai-features">
        <h2>5. AI writing helpers</h2>
        <p>
          Some optional tools, such as the helper that suggests profile wording
          for vendors, are written by AI (a computer program). AI can get things
          wrong or leave things out. A person must check everything it writes
          before relying on it. Vendors must read and approve any suggestion
          before it is published.
        </p>
      </section>

      <section id="external-links">
        <h2>6. Links to other websites</h2>
        <p>
          Eventtz may link to other websites or social media pages. We are not
          responsible for what they say or how they work.
        </p>
      </section>

      <section id="limitation">
        <h2>7. Limits on what we are responsible for</h2>
        <p>
          The limits on what Eventtz is responsible for are set out in one
          place only: the{" "}
          <Link href="/compliances/terms-of-service#liability">
            Terms of Service
          </Link>
          . Please read them there.
        </p>
      </section>

      <section id="contact">
        <h2>8. Contact us</h2>
        <p>
          Questions:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          See also our{" "}
          <Link href="/compliances/terms-of-service">Terms of Service</Link>.
        </p>
      </section>
    </>
  );
}
