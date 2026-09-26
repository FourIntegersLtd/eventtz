import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type ReferralPartnerRow = components["schemas"]["ReferralPartnerRow"];
export type ReferralVendorSignupRow = components["schemas"]["ReferralVendorSignupRow"];

/** Every partner, newest first, with the link each one shares. */
export async function fetchReferralPartners(): Promise<ReferralPartnerRow[]> {
  const response = await platformRequest<components["schemas"]["ReferralPartnerListResponse"]>(
    "/api/v1/admin/referrals/partners",
  );
  return response.partners;
}

/** Adds a partner; the slug comes from the chosen slug or the name, made unique. */
export async function createReferralPartner(
  body: components["schemas"]["CreateReferralPartnerRequest"],
): Promise<ReferralPartnerRow> {
  const response = await platformRequest<components["schemas"]["ReferralPartnerResponse"]>(
    "/api/v1/admin/referrals/partners",
    { method: "POST", body },
  );
  return response.partner;
}

/** Edits a partner's name, handle, notes or on/off switch (the slug never changes). */
export async function updateReferralPartner(
  partnerId: string,
  body: components["schemas"]["UpdateReferralPartnerRequest"],
): Promise<ReferralPartnerRow> {
  const response = await platformRequest<components["schemas"]["ReferralPartnerResponse"]>(
    `/api/v1/admin/referrals/partners/${encodeURIComponent(partnerId)}`,
    { method: "PATCH", body },
  );
  return response.partner;
}

/** One page of the vendors a partner brought in, newest first. */
export async function fetchReferralSignups(
  partnerId: string,
  offset = 0,
  limit = 50,
): Promise<{ partner: ReferralPartnerRow; signups: ReferralVendorSignupRow[]; total: number }> {
  return platformRequest<components["schemas"]["ReferralSignupListResponse"]>(
    `/api/v1/admin/referrals/partners/${encodeURIComponent(partnerId)}/signups`,
    { query: { offset, limit } },
  );
}

/** Marks a partner as thanked (or not) for bringing in a given vendor. */
export async function setReferralShoutout(userId: string, shoutoutCompleted: boolean): Promise<void> {
  await platformRequest(`/api/v1/admin/referrals/signups/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: { shoutout_completed: shoutoutCompleted },
  });
}
