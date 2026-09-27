"use client";

/**
 * Live referral-code preview for the fee estimate on the vendor profile.
 * The fetch result is stored with the key it answers, so a stale response
 * cannot update a newer spend or code.
 */
import { useEffect, useState } from "react";
import { fetchVendorReferralPreview } from "./api";
import { REFERRAL_LOWEST_TIER_SPEND_GBP } from "./bookingServiceFee";
import { formatVendorReferralCodeInput, normalizeVendorReferralCode } from "./vendorReferralAttribution";

type UseVendorReferralPreviewArgs = {
  vendorUserId: string;
  vendorPortionGbp: number;
  initialCode?: string | null;
};

type PreviewResult = {
  key: string;
  discountGbp: number;
  codeValid: boolean;
  error: string | null;
};

/** Referral field state and the discount the API says applies to this spend. */
export function useVendorReferralPreview({
  vendorUserId,
  vendorPortionGbp,
  initialCode,
}: UseVendorReferralPreviewArgs) {
  const [draftCode, setDraftCode] = useState<string | null>(null);
  const referralCode = draftCode ?? formatVendorReferralCodeInput(initialCode ?? "");
  const normalized = normalizeVendorReferralCode(referralCode);
  const currentKey = `${vendorUserId}|${normalized ?? ""}|${vendorPortionGbp}`;
  const [result, setResult] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (!normalized || !vendorUserId) return;
    let cancelled = false;
    const key = currentKey;
    fetchVendorReferralPreview(vendorUserId, normalized, vendorPortionGbp)
      .then((preview) => {
        if (cancelled) return;
        const codeValid = preview.code_valid;
        let error: string | null = null;
        if (!codeValid) {
          error = "That referral code is not valid for this vendor.";
        } else if (
          preview.qualified_discount_gbp <= 0 &&
          vendorPortionGbp < REFERRAL_LOWEST_TIER_SPEND_GBP
        ) {
          error = `Referral code saved — discount applies when the vendor total is £${REFERRAL_LOWEST_TIER_SPEND_GBP}+.`;
        }
        setResult({
          key,
          discountGbp: codeValid ? preview.qualified_discount_gbp : 0,
          codeValid,
          error,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({
          key,
          discountGbp: 0,
          codeValid: false,
          error: "Could not check referral code. Try again.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [normalized, currentKey, vendorUserId, vendorPortionGbp]);

  const settled = Boolean(normalized) && result?.key === currentKey;
  const formatError =
    referralCode.trim() && !normalized ? "Enter a valid referral code (1–6 digits)." : null;
  const validating = Boolean(normalized && vendorUserId) && !settled;
  const codeValid = settled ? (result?.codeValid ?? false) : false;
  const referralDiscountGbp = settled && codeValid ? (result?.discountGbp ?? 0) : 0;
  const error = formatError ?? (settled ? (result?.error ?? null) : null);

  const onReferralCodeChange = (value: string) => {
    setDraftCode(formatVendorReferralCodeInput(value));
  };

  return {
    referralCode,
    setReferralCode: onReferralCodeChange,
    onReferralCodeBlur: () => undefined,
    referralDiscountGbp,
    codeValid,
    validating,
    error,
    referralApplied: codeValid && referralDiscountGbp > 0,
    normalizedCode: codeValid ? normalizeVendorReferralCode(referralCode) : null,
  };
}
