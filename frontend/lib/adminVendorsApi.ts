import api from "@/lib/axios";
import type {
  VendorApprovalStatus,
  VendorListingOverride,
  VendorProfileStatus,
} from "@/lib/domain-types";

export type AdminVendorRow = {
  id: string | null;
  user_id: string;
  email: string | null;
  onboarding_status: VendorProfileStatus | string;
  approval_status: VendorApprovalStatus | string;
  current_step: number | null;
  profile_form_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean;
  stripe_payouts_enabled?: boolean;
  /** Stripe Connect can both charge and pay out for this vendor. */
  payouts_verified?: boolean;
  /** The vendor is live on client explore right now. */
  listing_visible?: boolean;
  /** Admin override on top of the automatic approval + Stripe rule. */
  listing_override?: VendorListingOverride | string;
  listing_override_reason?: string | null;
};

export type AdminVendorsQuery = {
  offset?: number;
  limit?: number;
  q?: string;
  approval_status?: string;
  status?: string;
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
  const { data } = await api.get<{
    success: boolean;
    vendors: AdminVendorRow[];
    total: number;
    offset: number;
    limit: number;
  }>("/api/v1/admin/vendors", {
    params: {
      offset: q.offset ?? 0,
      limit: q.limit ?? 50,
      q: q.q?.trim() || undefined,
      approval_status: q.approval_status || undefined,
      status: q.status || undefined,
    },
  });
  return {
    vendors: data.vendors ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? 0,
    limit: data.limit ?? 50,
  };
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
  const { data } = await api.patch<{
    success: boolean;
    user_id: string;
    status: string;
    email_sent: boolean;
  }>(`/api/v1/admin/vendors/${userId}/unsubmit`, {
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
  const { data } = await api.patch<{
    listing_override: VendorListingOverride | string;
    listing_visible: boolean;
  }>(`/api/v1/admin/vendors/${userId}/listing-override`, {
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
  const { data } = await api.patch<{
    listing_cover_image_url: string | null;
    display_order: string[];
    hidden_image_urls: string[];
  }>(`/api/v1/admin/vendors/${userId}/listing-media`, {
    display_order: payload.displayOrder,
    hidden_image_urls: payload.hiddenImageUrls,
  });
  return {
    listing_cover_image_url: data.listing_cover_image_url ?? null,
    display_order: data.display_order ?? payload.displayOrder,
    hidden_image_urls: data.hidden_image_urls ?? payload.hiddenImageUrls,
  };
}

export type AdminVendorRestoreStripeResult = {
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  restored_from_transfer_id: string | null;
};

export async function restoreAdminVendorStripeConnect(
  userId: string,
): Promise<AdminVendorRestoreStripeResult> {
  const { data } = await api.post<{
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
    restored_from_transfer_id: string | null;
  }>(`/api/v1/admin/vendors/${userId}/restore-stripe-connect`);
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

export type AdminVendorInsights = {
  success: boolean;
  user_id: string;
  review_average: number | null;
  review_count: number;
  bookings_total: number;
  bookings_by_status: Record<string, number>;
  bookings_by_month: AdminVendorBookingsByMonthRow[];
  open_disputes_on_bookings: number;
  explore_path: string;
};

export async function fetchAdminVendorInsights(userId: string): Promise<AdminVendorInsights> {
  const { data } = await api.get<AdminVendorInsights>(`/api/v1/admin/vendors/${userId}/insights`);
  return data;
}

export type AdminVendorProfileNudgeResult = {
  sent: number;
  skipped: number;
  failures: { user_id: string; error: string }[];
};

export async function postAdminVendorProfileNudge(
  userIds: string[],
): Promise<AdminVendorProfileNudgeResult> {
  const { data } = await api.post<{
    sent: number;
    skipped: number;
    failures?: { user_id: string; error: string }[];
  }>("/api/v1/admin/vendors/nudge-profile-complete", {
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
  const { data } = await api.post<{
    sent: number;
    skipped: number;
    failures?: { user_id: string; error: string }[];
  }>("/api/v1/admin/vendors/nudge-setup-payouts", {
    user_ids: userIds,
  });
  return {
    sent: data.sent ?? 0,
    skipped: data.skipped ?? 0,
    failures: data.failures ?? [],
  };
}
