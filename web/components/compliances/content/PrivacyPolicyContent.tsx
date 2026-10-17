import Link from "next/link";
import { ThirdPartyServicesTable } from "@/components/compliances/content/ThirdPartyServicesTable";
import {
  FOOTER_ADDRESS_LINES,
  FOOTER_COMPANY_NAME,
  FOOTER_CONTACT_EMAIL,
  FOOTER_PRIVACY_EMAIL,
} from "@/lib/footerLinks";

/**
 * The Privacy Policy page, written in plain English.
 *
 * UK data protection law requires some of these sections (who is responsible,
 * the legal reasons for using data, your rights). Keep them, but keep the words
 * simple.
 */
export function PrivacyPolicyContent() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="compliance-meta">
        Effective date: 1 July 2026
        <br />
        Last updated: 17 October 2026
      </p>
      <p>
        This policy explains what personal information Eventtz collects about
        you, why, who we share it with, how long we keep it, and your rights.
        “Personal information” means anything that can identify you, such as
        your name, email or phone number. Eventtz is run by{" "}
        {FOOTER_COMPANY_NAME} (“Eventtz”, “we”, “us”).
      </p>

      <section id="data-controller">
        <h2>1. Who is responsible for your information</h2>
        <p>
          {FOOTER_COMPANY_NAME} is responsible for your personal information on
          Eventtz. (The law calls this the “data controller”.)
        </p>
        <ul>
          <li>
            <strong>Company:</strong> {FOOTER_COMPANY_NAME}
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
        <h2>2. What we collect</h2>
        <h3>When you sign up</h3>
        <p>
          Your name, email address, phone number (if you give it), whether you
          are a client or a vendor, and anything you add to your profile.
        </p>
        <h3>If you are a vendor</h3>
        <p>
          Your business name, what you offer, your prices, when you are
          available, your photos and videos, where you work, and any documents
          we ask for to check your business.
        </p>
        <h3>When you book or are booked</h3>
        <p>
          The event details and dates, your messages with the other person, where
          the booking is up to, and a record of payments. Card payments are
          handled by Stripe, a payment company. We never see or keep your full
          card number.
        </p>
        <h3>Messages</h3>
        <p>
          Messages you send through Eventtz chat, messages to our support team,
          and the notification settings you choose.
        </p>
        <p>
          Eventtz staff do not read your chat messages as a matter of routine.
          A member of staff may read the messages about a booking only when we
          need to: to sort out a problem or complaint you or the other person
          has reported, to check for fraud or someone trying to take payment
          outside Eventtz, or when the law requires it.
        </p>
        <h3>How you use the website</h3>
        <p>
          Your device and browser type, your IP address (a number that
          identifies your internet connection), records of what happens on our
          systems, cookies (see our{" "}
          <Link href="/compliances/cookies-policy">Cookie Policy</Link>), and
          which pages you visit and buttons you click. We use a service called
          Mixpanel to count this. We use it to run Eventtz, keep it safe and make
          it better.
        </p>
      </section>

      <section id="how-we-use-data">
        <h2>3. What we use it for</h2>
        <ul>
          <li>to set up and run your account;</li>
          <li>to help clients find vendors and make bookings;</li>
          <li>to take payments and pay vendors, through Stripe;</li>
          <li>to send you messages about your bookings, your account and its safety;</li>
          <li>to help you when you contact us, and to sort out problems between clients and vendors;</li>
          <li>to improve listings and search, and to keep Eventtz safe;</li>
          <li>to follow the law, including tax rules.</li>
        </ul>
        <p>
          Vendors can choose to use our AI writing helper when setting up their
          profile. If they do, the profile text and some details about their
          photos are sent to OpenAI, only to write suggestions. The vendor reads
          and can change every suggestion before anything is published.
        </p>
      </section>

      <section id="legal-bases">
        <h2>4. Why the law allows us to use it</h2>
        <p>
          UK data protection law only lets us use your information for certain
          reasons. These are the reasons we rely on:
        </p>
        <ul>
          <li>
            <strong>To keep our agreement with you:</strong> we need it to run
            Eventtz and your bookings.
          </li>
          <li>
            <strong>Fair business reasons:</strong> to keep Eventtz safe, stop
            fraud and improve our service, but only where this does not unfairly
            affect you. (The law calls this “legitimate interests”.)
          </li>
          <li>
            <strong>Your permission:</strong> for optional marketing and optional
            cookies, where the law requires it. You can take your permission back
            at any time.
          </li>
          <li>
            <strong>The law requires it:</strong> for example, keeping records
            for tax.
          </li>
        </ul>
      </section>

      <section id="third-party-services">
        <h2>5. Companies that help us run Eventtz</h2>
        <p>
          We use the companies below to run Eventtz. Each one only gets the
          information it needs to do its job, and where possible we have a
          contract with it that protects your information.
        </p>
        <ThirdPartyServicesTable />
        <p>
          You can read Stripe’s privacy policy at{" "}
          <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer">
            stripe.com/gb/privacy
          </a>{" "}
          and Supabase’s at{" "}
          <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
            supabase.com/privacy
          </a>
          .
        </p>
      </section>

      <section id="international-transfers">
        <h2>6. Information sent outside the UK</h2>
        <p>
          Some of these companies handle information outside the UK, mostly in
          the USA and Europe. When that happens, we use the protections UK law
          requires, such as approved contracts, so your information is protected
          to UK standards.
        </p>
      </section>

      <section id="retention">
        <h2>7. How long we keep it</h2>
        <ul>
          <li>
            We keep your information while your account is open, and for as long
            as we need it to run your bookings, sort out problems, enforce our
            rules and follow the law.
          </li>
          <li>
            If you delete your account from Settings, we remove your profile,
            login, messages and saved details as soon as we reasonably can.
          </li>
          <li>
            UK tax and accounting rules make us keep booking and payment records
            for about six years after the end of the financial year they belong
            to. We keep them without your name, email or phone number.
          </li>
          <li>
            The other person on a booking can still see that booking’s details,
            such as the date, the venue and the amounts.
          </li>
        </ul>
      </section>

      <section id="your-rights">
        <h2>8. Your rights</h2>
        <p>Under UK data protection law, you can ask us to:</p>
        <ul>
          <li>give you a copy of the information we hold about you;</li>
          <li>correct information that is wrong;</li>
          <li>
            delete your information in some cases (you can do this yourself by
            deleting your account in Settings);
          </li>
          <li>stop or limit how we use your information in some cases;</li>
          <li>give you your information in a form you can take to another service, in some cases;</li>
          <li>stop using your information where we only use it because you gave permission.</li>
        </ul>
        <p>
          You can also complain to the Information Commissioner’s Office (ICO),
          the UK body that oversees data protection, at{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">
            ico.org.uk
          </a>
          .
        </p>
        <p>
          To use any of these rights, delete your account in Settings while
          signed in, or email us at{" "}
          <a href={`mailto:${FOOTER_PRIVACY_EMAIL}`}>{FOOTER_PRIVACY_EMAIL}</a>.
        </p>
      </section>

      <section id="security">
        <h2>9. Keeping it safe</h2>
        <p>
          We limit who can see your information, protect it with encryption
          (scrambling it so others cannot read it) while it travels over the
          internet, and give our staff only the access they need. No website can
          be completely safe, so please use a strong password and keep it to
          yourself.
        </p>
      </section>

      <section id="children">
        <h2>10. Children</h2>
        <p>
          Eventtz is not for anyone under 18. We do not knowingly collect
          information about children.
        </p>
      </section>

      <section id="changes">
        <h2>11. Changes to this policy</h2>
        <p>
          We may update this policy. When we make an important change, we will
          post the new version here and change the “Last updated” date at the
          top. If you keep using Eventtz after that, the new version applies to
          you.
        </p>
      </section>

      <section id="contact">
        <h2>12. Contact us</h2>
        <p>
          Questions about this policy or your information:{" "}
          <a href={`mailto:${FOOTER_CONTACT_EMAIL}`}>{FOOTER_CONTACT_EMAIL}</a>.
          See also our{" "}
          <Link href="/compliances/cookies-policy">Cookie Policy</Link> and{" "}
          <Link href="/compliances/terms-of-service">Terms of Service</Link>.
        </p>
      </section>
    </>
  );
}
