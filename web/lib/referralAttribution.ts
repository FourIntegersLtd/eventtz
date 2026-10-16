import { publicSiteUrl } from "@/lib/siteUrl";

const REFERRAL_COOKIE = "eventtz_ref";
const REFERRAL_MAX_AGE_DAYS = 30;

function isValidRefSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function normalizeReferralSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase().replace(/\s+/g, "-");
  return isValidRefSlug(slug) ? slug : null;
}

export function readReferralFromUrl(searchParams: URLSearchParams): string | null {
  return normalizeReferralSlug(searchParams.get("ref"));
}

/** First-touch: only set cookie when absent. */
export function persistReferralSlug(slug: string): void {
  if (typeof document === "undefined" || !isValidRefSlug(slug)) return;
  const existing = getStoredReferralSlug();
  if (existing) return;
  const maxAge = REFERRAL_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function getStoredReferralSlug(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return normalizeReferralSlug(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function captureReferralFromSearchParams(searchParams: URLSearchParams): string | null {
  const fromUrl = readReferralFromUrl(searchParams);
  if (fromUrl) {
    persistReferralSlug(fromUrl);
    return fromUrl;
  }
  return getStoredReferralSlug();
}

export async function fetchReferralPartnerDisplayName(slug: string): Promise<string | null> {
  try {
    const res = await fetch(publicSiteUrl(`/api/v1/referrals/partners/${encodeURIComponent(slug)}`), {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name?.trim() || null;
  } catch {
    return null;
  }
}
