import api from "@/lib/axios";

export type ReferralFeeTier = {
  min_spend_gbp: number;
  fee_discount_gbp: number;
};

export type VendorClientReferralInfo = {
  referral_code: string;
  has_referral_code: boolean;
  share_link: string;
  service_fee_percent: number;
  tiers: ReferralFeeTier[];
  enabled: boolean;
};

export type VendorReferralSetCodeResponse = {
  referral_code: string;
  share_link: string;
};

export type VendorReferralPreview = {
  valid: boolean;
  code_valid: boolean;
  tiers: ReferralFeeTier[];
  service_fee_percent: number;
  qualified_discount_gbp: number;
  tier_min_spend_gbp: number | null;
  service_fee_before_discount_gbp: number;
  service_fee_gbp: number;
};

export type VendorReferralBookingRow = {
  booking_request_id: string;
  event_name: string;
  event_date: string;
  booking_status: string;
  payment_status: string;
  vendor_portion_gbp: number;
  referral_fee_discount_gbp: number;
  client_display_name: string | null;
  created_at: string | null;
};

export type VendorReferralBookingsResponse = {
  total_referral_bookings: number;
  total_fee_savings_gbp: number;
  bookings: VendorReferralBookingRow[];
};

export async function fetchVendorClientReferral(): Promise<VendorClientReferralInfo> {
  const { data } = await api.get<VendorClientReferralInfo>("/api/v1/vendor/referral");
  return data;
}

export async function fetchVendorReferralBookings(): Promise<VendorReferralBookingsResponse> {
  const { data } = await api.get<VendorReferralBookingsResponse>("/api/v1/vendor/referral/bookings");
  return data;
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

export async function setVendorReferralCode(input: {
  code?: string;
  generate?: boolean;
}): Promise<VendorReferralSetCodeResponse> {
  const { data } = await api.post<VendorReferralSetCodeResponse>("/api/v1/vendor/referral/code", input);
  return data;
}
