import api from "@/lib/axios";
import type { ApiListResponse } from "@/lib/api-types";
import type { VendorApprovalStatus, VendorProfileStatus } from "@/lib/domain-types";

export type ExploreVendor = {
  user_id: string;
  email?: string | null;
  status?: VendorProfileStatus | string;
  approval_status?: VendorApprovalStatus | string;
  payload: Record<string, unknown>;
  updated_at?: string;
  /** Average star rating (1–5), when reviews exist. */
  review_average?: number | null;
  review_count?: number;
};

export type ExploreVendorSearchRow = ExploreVendor & {
  matched_services: string[];
  /** exact | related | fallback — close-enough search tier */
  match_tier?: "exact" | "related" | "fallback";
};

export type MarketplaceSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "proximity"
  | "rating";

export type ExploreSearchQuery = {
  query?: string;
  types?: string[];
  location?: string;
  dates?: string[];
  flexible?: boolean;
  budgetMin?: number | null;
  budgetMax?: number | null;
  sort?: MarketplaceSort;
};

type ExploreVendorSearchApiResponse = {
  success: boolean;
  total_count: number;
  vendors: ExploreVendorSearchRow[];
  match_notice?: string | null;
  has_exact?: boolean;
  has_related?: boolean;
};

export async function fetchExploreVendors(): Promise<ExploreVendor[]> {
  const { data } = await api.get<ApiListResponse<ExploreVendor>>("/api/v1/vendors/explore");
  return data.vendors ?? [];
}

/** Single listed vendor — use on `/client/browse/[id]` instead of loading the full explore list. */
export async function fetchExploreVendorById(
  vendorUserId: string,
): Promise<ExploreVendor | null> {
  try {
    const { data } = await api.get<{ success: boolean; vendor: ExploreVendor }>(
      `/api/v1/vendors/explore/vendor/${encodeURIComponent(vendorUserId)}`,
    );
    return data.vendor ?? null;
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err.response?.status === 404) return null;
    throw e;
  }
}

export async function fetchExploreVendorsSearch(
  q: ExploreSearchQuery,
): Promise<{
  totalCount: number;
  vendors: ExploreVendorSearchRow[];
  matchNotice: string | null;
  hasExact: boolean;
  hasRelated: boolean;
}> {
  const sp = new URLSearchParams();
  const searchText = (q.query?.trim() || q.location?.trim()) ?? "";
  if (searchText) sp.set("q", searchText);
  if (q.types?.length) sp.set("types", q.types.join(","));
  if (q.location?.trim() && q.query?.trim()) {
    // Dedicated location (when distinct from q) — backend treats as soft signal.
    sp.set("location", q.location.trim());
  }
  if (q.dates?.length && !q.flexible) {
    sp.set("dates", q.dates.slice(0, 3).join(","));
  }
  if (q.flexible) sp.set("flexible", "true");
  if (q.budgetMin != null) sp.set("budget_min", String(q.budgetMin));
  if (q.budgetMax != null) sp.set("budget_max", String(q.budgetMax));
  if (q.sort && q.sort !== "relevance") sp.set("sort", q.sort);

  const qs = sp.toString();
  const url = qs
    ? `/api/v1/vendors/explore/search?${qs}`
    : "/api/v1/vendors/explore/search";
  const { data } = await api.get<ExploreVendorSearchApiResponse>(url);
  return {
    totalCount: data.total_count ?? 0,
    vendors: data.vendors ?? [],
    matchNotice: data.match_notice ?? null,
    hasExact: Boolean(data.has_exact),
    hasRelated: Boolean(data.has_related),
  };
}
