import Link from "next/link";
import { Card } from "@/foundation/ui";

/**
 * The `/` home page's content.
 *
 * The baseline's home page (`LandingMarketplace`) is a full marketplace
 * hero: an autoplaying video, animated vendor carousels, a live category
 * search, and inspiration slides — built on packages (a video/animation
 * runtime, embla-carousel, lucide-react icons) this workstream is not
 * approved to install (see the final report), and it renders vendor data
 * that belongs to the browse/marketplace workstream, not this one. This is
 * a simplified page carrying the same top-level message and the same entry
 * points (register, sign in, browse), so `/` renders correctly today and
 * can be replaced in place once that workstream lands.
 */
export function HomeView() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <section className="text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
          Find and book event vendors, all in one place
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600">
          Eventtz connects you with caterers, DJs, venues and more — send an enquiry, pay securely through
          Stripe, and confirm the booking once the event is done.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-muted"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        <Card padding="lg">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Browse vendors</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Search caterers, DJs, venues and more, and message vendors directly about your event.
          </p>
        </Card>
        <Card padding="lg">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Pay with confidence</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Payments are held by Eventtz until the event is confirmed complete, then released to the vendor.
          </p>
        </Card>
        <Card padding="lg">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">For vendors</h2>
          <p className="mt-2 text-sm text-neutral-600">
            List your services, respond to enquiries, and get paid out through Stripe Connect.
          </p>
        </Card>
      </section>

      <section className="mt-16 text-center">
        <h2 className="font-heading text-2xl font-semibold text-neutral-900">Read the blog</h2>
        <p className="mt-2 text-neutral-600">Stories, tips, and updates from the Eventtz team.</p>
        <Link href="/blog" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Visit the blog →
        </Link>
      </section>
    </div>
  );
}
