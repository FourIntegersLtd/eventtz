import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type ReferralFeeTier = components["schemas"]["ReferralFeeTier"];

/** Without the `success` flag, so a screen can build one from a freshly created code. */
export type VendorClientReferralInfo = Omit<
  components["schemas"]["VendorClientReferralResponse"],
  "success"
>;

export type VendorReferralSetCodeResponse = components["schemas"]["VendorReferralSetCodeResponse"];

export type VendorReferralPreview = components["schemas"]["VendorReferralPreviewResponse"];

export type VendorReferralBookingRow = components["schemas"]["VendorReferralBookingRow"];

export type VendorReferralBookingsResponse = components["schemas"]["VendorReferralBookingsResponse"];

export const VENDOR_REFERRAL_BOOKINGS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function fetchVendorClientReferral(): Promise<VendorClientReferralInfo> {
  const { data } = await api.get<VendorClientReferralInfo>("/api/v1/vendor/referral");
  return data;
}

export async function fetchVendorReferralBookingsPage(
  offset = 0,
  limit = VENDOR_REFERRAL_BOOKINGS_PAGE_SIZE,
): Promise<VendorReferralBookingsResponse> {
  const { data } = await api.get<VendorReferralBookingsResponse>("/api/v1/vendor/referral/bookings", {
    params: { offset, limit },
  });
  return data;
}

export async function fetchVendorReferralBookings(): Promise<VendorReferralBookingsResponse> {
  return fetchVendorReferralBookingsPage(0, 200);
}

export async function fetchVendorReferralPreview(
  vendorUserId: string,
  code: string,
  vendorPortionGbp: number,
): Promise<VendorReferralPreview> {
  const { data } = await api.get<VendorReferralPreview>(
    `/api/v1/vendors/explore/vendor/${encodeURIComponent(vendorUserId)}/referral-preview`,
    { params: { code, vendor_portion_gbp: vendorPortionGbp } },
  );
  return data;
}

export async function setVendorReferralCode(input: Partial<components["schemas"]["VendorReferralSetCodeRequest"]>): Promise<VendorReferralSetCodeResponse> {
  const { data } = await api.post<VendorReferralSetCodeResponse>("/api/v1/vendor/referral/code", input);
  return data;
}
