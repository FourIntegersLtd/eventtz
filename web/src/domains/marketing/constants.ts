/**
 * Shared marketing/legal constants. Ported from the baseline's
 * `frontend/lib/footerLinks.ts` and `frontend/lib/bookingServiceFee.ts` —
 * values must match exactly, since the compliance pages quote them.
 */

export const FOOTER_COMPANY_NAME = "Eventtz Ltd";
export const FOOTER_CONTACT_EMAIL = "hello@eventtz.com";
export const FOOTER_PRIVACY_EMAIL = "hello@eventtz.com";

export const FOOTER_ADDRESS_LINES = ["82a James Carter Road", "Mildenhall, IP28 7DE", "England, UK"] as const;

export const FOOTER_LEGAL_LINKS = [
  { href: "/compliances/privacy-policy", label: "Privacy policy" },
  { href: "/compliances/cookies-policy", label: "Cookie policy" },
  { href: "/compliances/terms-of-service", label: "Terms of service" },
  { href: "/compliances/legal-disclaimer", label: "Legal disclaimer" },
  { href: "/compliances/referrals", label: "Referral policy" },
] as const;

/** Matches `api/app/features/pricing/service.py`'s `BOOKING_SERVICE_FEE_PERCENT`. */
export const BOOKING_SERVICE_FEE_PERCENT = 5;
