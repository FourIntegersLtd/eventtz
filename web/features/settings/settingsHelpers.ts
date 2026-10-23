import { getApiErrorCode, getApiErrorDetail, isHttpStatus } from "@/lib/api-errors";
import type { VendorClientReferralInfo } from "@/lib/vendorReferralsApi";
import { updateContactSharingSettings, type ContactSharingSettings } from "@/lib/userSettingsApi";

const DELETE_CONFLICT_MESSAGES: Record<string, string> = {
  money_in_flight:
    "You have a booking with payment still in progress. Finish payout or wait for a refund, then try again.",
  active_booking:
    "You have an accepted booking that has not happened yet. Complete or cancel it first, then try again.",
  open_dispute:
    "You have an open problem report. Wait until it is resolved, then try again.",
};

/** Maps a close-account failure to the copy both settings screens show. */
export function deleteAccountErrorMessage(err: unknown): string {
  const code = getApiErrorCode(err);
  if (code && DELETE_CONFLICT_MESSAGES[code]) {
    return DELETE_CONFLICT_MESSAGES[code];
  }
  return getApiErrorDetail(err) ?? "Could not delete your account. Try again.";
}

/** Saves one contact-sharing switch and returns the stored settings. */
export async function persistContactSharingToggle(
  current: ContactSharingSettings,
  key: keyof Pick<ContactSharingSettings, "share_email" | "share_phone">,
): Promise<ContactSharingSettings> {
  return updateContactSharingSettings({ [key]: !current[key] });
}

/** True when referrals are hidden because the listing is not approved yet. */
export function referralUnavailableError(err: unknown): boolean {
  return isHttpStatus(err, 404);
}

/** Folds a newly created code into the referral info already on screen. */
export function withCreatedReferralCode(
  prev: VendorClientReferralInfo | null,
  result: { referral_code: string; share_link: string },
): VendorClientReferralInfo | null {
  if (!prev) {
    return {
      referral_code: result.referral_code,
      has_referral_code: true,
      share_link: result.share_link,
      service_fee_percent: 0,
      tiers: [],
      enabled: true,
    };
  }
  return {
    ...prev,
    referral_code: result.referral_code,
    has_referral_code: true,
    share_link: result.share_link,
  };
}
