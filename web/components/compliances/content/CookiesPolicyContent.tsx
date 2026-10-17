import Link from "next/link";
import { ThirdPartyServicesTable } from "@/components/compliances/content/ThirdPartyServicesTable";
import { FOOTER_COMPANY_NAME, FOOTER_CONTACT_EMAIL } from "@/lib/footerLinks";

/** The Cookie Policy page, written in plain English. */
export function CookiesPolicyContent() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="compliance-meta">
        Effective date: 1 July 2026
        <br />
        Last updated: 17 October 2026
      </p>
      <p>
        This policy explains how Eventtz, run by {FOOTER_COMPANY_NAME}, uses
        cookies when you visit eventtz.com.
      </p>

      <section id="what-are-cookies">
        <h2>1. What cookies are</h2>
        <p>
          Cookies are small files that a website saves on your phone or
          computer. They let the website remember you, for example so you stay
          signed in, and help it understand how pages are used.
        </p>
      </section>

      <section id="how-we-use-cookies">
        <h2>2. The cookies we use</h2>
        <h3>Cookies we need to make Eventtz work</h3>
        <p>
          These keep you signed in, keep your account safe and keep the website
          running smoothly. You cannot turn them off if you want to use your
          account.
        </p>
        <h3>Cookies that remember your choices</h3>
        <p>
          These remember settings you pick, such as your notification choices or
          how the page is laid out.
        </p>
        <h3>Cookies that help us improve Eventtz</h3>
        <p>
          These count which pages are visited and which main steps people take,
          such as signing in or sending a booking request. We use a service
          called Mixpanel for this. Where the law requires it, we ask your
          permission first.
        </p>
      </section>

      <section id="third-party-cookies">
        <h2>3. Cookies from other companies</h2>
        <p>
          Some cookies, or similar ways of saving information on your device,
          come from companies we use to run Eventtz, such as our payment and
          hosting companies:
        </p>
        <ThirdPartyServicesTable />
        <p>
          Stripe, our payment company, may save cookies when you pay or when a
          vendor sets up how they get paid. Stripe’s own policies explain how.
        </p>
      </section>

      <section id="managing-cookies">
        <h2>4. How to control cookies</h2>
        <p>
          You can block or delete cookies in your browser’s settings. Most
          browsers let you delete the cookies already saved and block new ones.
          If you block the cookies we need, you will not be able to sign in or
          make bookings.
        </p>
      </section>

      <section id="updates">
        <h2>5. Changes to this policy</h2>
        <p>
          We will update this policy if the cookies we use change. The latest
          version is always on this page.
        </p>
      </section>

      <section id="contact">
        <h2>6. Contact us</h2>
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
