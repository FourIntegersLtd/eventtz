import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type ReferralPartner = components["schemas"]["ReferralPartnerRow"];

export type ReferralVendorSignup = components["schemas"]["ReferralVendorSignupRow"];

export type ShoutoutFilter = "all" | "pending" | "completed";

export const ADMIN_REFERRAL_PARTNERS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function fetchReferralPartnersPage(
  offset = 0,
  limit = ADMIN_REFERRAL_PARTNERS_PAGE_SIZE,
): Promise<{
  partners: ReferralPartner[];
  total: number;
  /** Switched-on partners across every page, not just this one. */
  activeTotal: number;
  offset: number;
  limit: number;
}> {
  const { data } = await api.get<components["schemas"]["ReferralPartnerListResponse"]>(
    "/api/v1/admin/referrals/partners",
    { params: { offset, limit } },
  );
  return {
    partners: data.partners ?? [],
    total: data.total ?? 0,
    activeTotal: data.active_total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

export async function createReferralPartner(body: components["schemas"]["CreateReferralPartnerRequest"]): Promise<ReferralPartner> {
  const { data } = await api.post<components["schemas"]["ReferralPartnerResponse"]>(
    "/api/v1/admin/referrals/partners",
    body,
  );
  return data.partner;
}

export async function updateReferralPartner(
  partnerId: string,
  body: components["schemas"]["UpdateReferralPartnerRequest"],
): Promise<ReferralPartner> {
  const { data } = await api.patch<components["schemas"]["ReferralPartnerResponse"]>(
    `/api/v1/admin/referrals/partners/${partnerId}`,
    body,
  );
  return data.partner;
}

export async function fetchReferralSignups(
  partnerId: string,
  opts?: { offset?: number; limit?: number; shoutout?: ShoutoutFilter },
): Promise<{
  partner: ReferralPartner;
  signups: ReferralVendorSignup[];
  total: number;
  offset: number;
  limit: number;
}> {
  const params = new URLSearchParams();
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.shoutout) params.set("shoutout", opts.shoutout);
  const qs = params.toString();
  const { data } = await api.get<components["schemas"]["ReferralSignupListResponse"]>(
    `/api/v1/admin/referrals/partners/${partnerId}/signups${qs ? `?${qs}` : ""}`,
  );
  return data;
}

export async function patchReferralShoutout(
  userId: string,
  shoutoutCompleted: boolean,
): Promise<ReferralVendorSignup> {
  const { data } = await api.patch<ReferralVendorSignup>(
    `/api/v1/admin/referrals/signups/${userId}`,
    { shoutout_completed: shoutoutCompleted } satisfies components["schemas"]["UpdateReferralShoutoutRequest"],
  );
  return data;
}
