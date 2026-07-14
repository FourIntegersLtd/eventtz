import Link from "next/link";
import { ThirdPartyServicesTable } from "@/components/compliances/content/ThirdPartyServicesTable";
import { FOOTER_CONTACT_EMAIL } from "@/lib/footerLinks";

export function CookiesPolicyContent() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="compliance-meta">
        Effective date: 1 July 2026
        <br />
        Last updated: 14 July 2026
      </p>
      <p>
        This Cookie Policy explains how Eventtz, operated by Four Integers Ltd,
        uses cookies and similar technologies when you visit eventtz.com and
        related pages.
      </p>

      <section id="what-are-cookies">
        <h2>1. What are cookies?</h2>
        <p>
          Cookies are small text files stored on your device. They help websites
          remember preferences, keep you signed in, and understand how pages are
          used.
        </p>
      </section>

      <section id="how-we-use-cookies">
        <h2>2. How we use cookies</h2>
        <h3>Strictly necessary</h3>
        <p>
          Required for core functionality such as authentication sessions,
          security, and load balancing. These cannot be switched off if you want
          to use signed-in features.
        </p>
        <h3>Functional</h3>
        <p>
          Remember choices such as notification preferences or UI settings to
          improve your experience.
        </p>
        <h3>Analytics</h3>
        <p>
          Help us understand traffic patterns and improve performance. Where
          used, analytics cookies are deployed in a privacy-conscious manner
          and may be subject to consent depending on your jurisdiction.
        </p>
      </section>

      <section id="third-party-cookies">
        <h2>3. Third-party technologies</h2>
        <p>
          Some cookies or storage mechanisms are set by services we integrate
          with to operate Eventtz, including payment and hosting providers:
        </p>
        <ThirdPartyServicesTable />
        <p>
          Stripe may use cookies or similar storage when you complete checkout
          or manage payouts. Refer to Stripe&apos;s policies for details.
        </p>
      </section>

      <section id="managing-cookies">
        <h2>4. Managing cookies</h2>
        <p>
          You can control cookies through your browser settings. Blocking
          strictly necessary cookies may prevent you from logging in or
          completing bookings. Most browsers let you delete existing cookies and
          block future ones.
        </p>
      </section>

      <section id="updates">
        <h2>5. Updates</h2>
        <p>
          We may update this Cookie Policy when our use of cookies changes.
          Check this page for the latest version.
        </p>
      </section>

      <section id="contact">
        <h2>6. Contact</h2>
        <p>
          Questions about cookies:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          See also our{" "}
          <Link href="/compliances/privacy-policy">Privacy Policy</Link>.
        </p>
      </section>
    </>
  );
}
