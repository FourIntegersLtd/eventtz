import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * `/explore` and `/client/browse` used to be two divergent marketplace URLs
 * rendering the same view with different chrome. `/client/browse` is now
 * the single canonical route with the shared site top nav (see
 * `MarketplaceBrowseShell` / `LandingNav`). This keeps old bookmarked/shared `/explore`
 * links working by redirecting with the search preserved.
 */
export default async function ExploreRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else if (value != null) {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `/client/browse?${suffix}` : "/client/browse");
}
