/** Live public site — use for shareable links (referrals, etc.), not localhost. */
export const PUBLIC_SITE_URL = "https://www.eventtz.com";

export function publicSiteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_SITE_URL}${normalized}`;
}

export function referralRegisterUrl(slug: string): string {
  return publicSiteUrl(`/vendor/register?ref=${encodeURIComponent(slug)}`);
}

/** Vendor profile editor (onboarding wizard lives at `/vendor/profile`). */
export function vendorProfileUrl(): string {
  return publicSiteUrl("/vendor/profile");
}
