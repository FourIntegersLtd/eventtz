"use client";

import { SOCIAL_LINKS, WAITLIST_URL } from "@/features/landing/landingData";

const CONTACT_EMAIL = "hello@eventtz.co.uk";

export function LandingFooter() {
  return (
    <footer className="border-t border-primary-border/60 bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-16">
        <p className="text-center font-heading text-lg font-semibold text-primary">Eventtz</p>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-neutral-600">
          UK marketplace for <span className="font-medium text-accent-violet">African event vendors</span>.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Contact
          </a>
          <a
            href={WAITLIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent-violet underline-offset-2 hover:text-primary hover:underline"
          >
            Join waitlist
          </a>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {SOCIAL_LINKS.map(({ name, href, aria, Icon, color }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={aria}
              className={`rounded-full border border-primary-border p-2.5 transition hover:border-primary/30 hover:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-white ${color}`}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
