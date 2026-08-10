import api from "@/lib/axios";

export type ReferralPartner = {
  id: string;
  slug: string;
  display_name: string;
  instagram_handle: string | null;
  notes: string | null;
  is_active: boolean;
  referral_link: string;
  created_at: string | null;
  updated_at: string | null;
};

export type ReferralVendorSignup = {
  user_id: string;
  email: string | null;
  business_name: string | null;
  approval_status: string | null;
  profile_status: string | null;
  attributed_at: string | null;
  shoutout_completed: boolean;
  shoutout_completed_at: string | null;
  explore_path: string | null;
};

export type ShoutoutFilter = "all" | "pending" | "completed";

export async function fetchReferralPartners(): Promise<ReferralPartner[]> {
  const { data } = await api.get<{ partners: ReferralPartner[] }>("/api/v1/admin/referrals/partners");
  return data.partners ?? [];
}

export async function createReferralPartner(body: {
  display_name: string;
  instagram_handle?: string;
  slug?: string;
  notes?: string;
}): Promise<ReferralPartner> {
  const { data } = await api.post<{ partner: ReferralPartner }>("/api/v1/admin/referrals/partners", body);
  return data.partner;
}

export async function updateReferralPartner(
  partnerId: string,
  body: {
    display_name?: string;
    instagram_handle?: string;
    notes?: string;
    is_active?: boolean;
  },
): Promise<ReferralPartner> {
  const { data } = await api.patch<{ partner: ReferralPartner }>(
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
  const { data } = await api.get<{
    partner: ReferralPartner;
    signups: ReferralVendorSignup[];
    total: number;
    offset: number;
    limit: number;
  }>(`/api/v1/admin/referrals/partners/${partnerId}/signups${qs ? `?${qs}` : ""}`);
  return data;
}

export async function patchReferralShoutout(
  userId: string,
  shoutoutCompleted: boolean,
): Promise<ReferralVendorSignup> {
  const { data } = await api.patch<ReferralVendorSignup>(
    `/api/v1/admin/referrals/signups/${userId}`,
    { shoutout_completed: shoutoutCompleted },
  );
  return data;
}
