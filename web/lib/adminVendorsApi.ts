import type { components } from "@/lib/api-schema";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";
import type {
  VendorApprovalStatus,
  VendorListingOverride,
  VendorProfileStatus,
} from "@/lib/domain-types";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type AdminVendorRow = components["schemas"]["AdminVendorRow"];

export type AdminVendorInsuranceStatus =
  | "missing"
  | "awaiting_check"
  | "verified"
  | "expiring"
  | "expired";

export type AdminVendorInsurance = components["schemas"]["VendorInsuranceState"];

export type AdminVendorsQuery = {
  offset?: number;
  limit?: number;
  q?: string;
  approval_status?: string;
  status?: string;
  /** When filtering drafts: true = staff returned for edits; false = in-progress onboarding. */
  returned_for_edits?: boolean;
};

export type AdminVendorsListResult = {
  vendors: AdminVendorRow[];
  total: number;
  offset: number;
  limit: number;
};

export async function fetchAdminVendors(
  q: AdminVendorsQuery = {},
): Promise<AdminVendorsListResult> {
  const { data } = await api.get<components["schemas"]["AdminVendorsListResponse"]>("/api/v1/admin/vendors", {
    params: {
      offset: q.offset ?? 0,
      limit: q.limit ?? DEFAULT_LIST_PAGE_SIZE,
      q: q.q?.trim() || undefined,
      approval_status: q.approval_status || undefined,
      status: q.status || undefined,
      returned_for_edits: q.returned_for_edits,
    },
  });
  return {
    vendors: data.vendors ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? 0,
    limit: data.limit ?? DEFAULT_LIST_PAGE_SIZE,
  };
}

/** One vendor, in the list's row shape, for the vendor's own admin page. */
export async function fetchAdminVendor(userId: string): Promise<AdminVendorRow> {
  const { data } = await api.get<components["schemas"]["AdminVendorDetailResponse"]>(
    `/api/v1/admin/vendors/${userId}`,
  );
  return data.vendor;
}

export async function patchVendorApproval(
  userId: string,
  approval_status: VendorApprovalStatus,
): Promise<void> {
  await api.patch(`/api/v1/admin/vendors/${userId}/approval`, {
    approval_status,
  });
}

export type AdminVendorUnsubmitResult = {
  status: string;
  email_sent: boolean;
};

export async function patchVendorUnsubmit(
  userId: string,
  options: { message?: string; sendEmail?: boolean } = {},
): Promise<AdminVendorUnsubmitResult> {
  const { data } = await api.patch<components["schemas"]["AdminVendorUnsubmitResponse"]>(`/api/v1/admin/vendors/${userId}/unsubmit`, {
    message: options.message?.trim() || undefined,
    send_email: options.sendEmail ?? true,
  });
  return {
    status: data.status ?? "draft",
    email_sent: Boolean(data.email_sent),
  };
}

export async function patchVendorListingOverride(
  userId: string,
  listing_override: VendorListingOverride,
  reason?: string,
): Promise<{ listing_override: VendorListingOverride | string; listing_visible: boolean }> {
  const { data } = await api.patch<components["schemas"]["AdminVendorListingOverrideResponse"]>(`/api/v1/admin/vendors/${userId}/listing-override`, {
    listing_override,
    reason: reason?.trim() || undefined,
  });
  return {
    listing_override: data.listing_override ?? listing_override,
    listing_visible: Boolean(data.listing_visible),
  };
}

export type AdminListingMediaSavePayload = {
  displayOrder: string[];
  hiddenImageUrls: string[];
};

export async function patchVendorListingMedia(
  userId: string,
  payload: AdminListingMediaSavePayload,
): Promise<{
  listing_cover_image_url: string | null;
  display_order: string[];
  hidden_image_urls: string[];
}> {
  const { data } = await api.patch<components["schemas"]["AdminVendorListingMediaResponse"]>(`/api/v1/admin/vendors/${userId}/listing-media`, {
    display_order: payload.displayOrder,
    hidden_image_urls: payload.hiddenImageUrls,
  });
  return {
    listing_cover_image_url: data.listing_cover_image_url ?? null,
    display_order: data.display_order ?? payload.displayOrder,
    hidden_image_urls: data.hidden_image_urls ?? payload.hiddenImageUrls,
  };
}

export type AdminVendorRestoreStripeResult = Omit<
  components["schemas"]["AdminVendorRestoreStripeConnectResponse"],
  "success" | "user_id"
>;

export async function restoreAdminVendorStripeConnect(
  userId: string,
): Promise<AdminVendorRestoreStripeResult> {
  const { data } = await api.post<components["schemas"]["AdminVendorRestoreStripeConnectResponse"]>(`/api/v1/admin/vendors/${userId}/restore-stripe-connect`);
  return {
    stripe_account_id: data.stripe_account_id ?? null,
    stripe_charges_enabled: Boolean(data.stripe_charges_enabled),
    stripe_payouts_enabled: Boolean(data.stripe_payouts_enabled),
    restored_from_transfer_id: data.restored_from_transfer_id ?? null,
  };
}

export type AdminVendorBookingsByMonthRow = {
  month: string;
  [status: string]: string | number;
};

/** `bookings_by_month` rows are free-form dicts in the API schema; narrowed by hand. */
export type AdminVendorInsights = WithFields<
  components["schemas"]["AdminVendorInsightsResponse"],
  { bookings_by_month: AdminVendorBookingsByMonthRow[] }
>;

export async function fetchAdminVendorInsights(userId: string): Promise<AdminVendorInsights> {
  const { data } = await api.get<AdminVendorInsights>(`/api/v1/admin/vendors/${userId}/insights`);
  return data;
}

export type AdminVendorProfileNudgeResult = Omit<components["schemas"]["AdminVendorProfileNudgeResponse"], "success">;

export async function postAdminVendorProfileNudge(
  userIds: string[],
): Promise<AdminVendorProfileNudgeResult> {
  const { data } = await api.post<components["schemas"]["AdminVendorProfileNudgeResponse"]>("/api/v1/admin/vendors/nudge-profile-complete", {
    user_ids: userIds,
  });
  return {
    sent: data.sent ?? 0,
    skipped: data.skipped ?? 0,
    failures: data.failures ?? [],
  };
}

export async function postAdminVendorPayoutNudge(
  userIds: string[],
): Promise<AdminVendorProfileNudgeResult> {
  const { data } = await api.post<components["schemas"]["AdminVendorProfileNudgeResponse"]>("/api/v1/admin/vendors/nudge-setup-payouts", {
    user_ids: userIds,
  });
  return {
    sent: data.sent ?? 0,
    skipped: data.skipped ?? 0,
    failures: data.failures ?? [],
  };
}

/** Email the vendor a formal warning (recorded in the audit log). */
export async function postVendorWarning(userId: string, message: string): Promise<boolean> {
  const { data } = await api.post<components["schemas"]["AdminVendorWarnResponse"]>(`/api/v1/admin/vendors/${userId}/warn`, {
    message: message.trim(),
  });
  return Boolean(data.email_sent);
}

/** Hide the vendor's listing for `days` days; it returns on its own. */
export async function putVendorListingPause(
  userId: string,
  days: number,
  reason: string,
): Promise<{ listing_paused_until: string | null }> {
  const { data } = await api.put<components["schemas"]["AdminVendorPauseResponse"]>(
    `/api/v1/admin/vendors/${userId}/listing-pause`,
    { days, reason: reason.trim() },
  );
  return { listing_paused_until: data.listing_paused_until ?? null };
}

/** End a listing pause early. */
export async function deleteVendorListingPause(userId: string): Promise<void> {
  await api.delete(`/api/v1/admin/vendors/${userId}/listing-pause`);
}

/** Record a checked certificate: when its cover ends and how much it is. */
export async function putVendorInsurance(
  userId: string,
  expiresOn: string,
  coverGbp: number,
): Promise<{ insurance: AdminVendorInsurance; listing_visible: boolean }> {
  const { data } = await api.put<components["schemas"]["AdminVendorInsuranceResponse"]>(
    `/api/v1/admin/vendors/${userId}/insurance`,
    { expires_on: expiresOn, cover_gbp: coverGbp },
  );
  return { insurance: data.insurance, listing_visible: Boolean(data.listing_visible) };
}

/** Withdraw a check (wrong certificate, or cover cancelled). */
export async function deleteVendorInsurance(
  userId: string,
): Promise<{ insurance: AdminVendorInsurance; listing_visible: boolean }> {
  const { data } = await api.delete<components["schemas"]["AdminVendorInsuranceResponse"]>(
    `/api/v1/admin/vendors/${userId}/insurance`,
  );
  return { insurance: data.insurance, listing_visible: Boolean(data.listing_visible) };
}
