"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchVendorReferralPreview } from "@/lib/vendorReferralsApi";
import { REFERRAL_LOWEST_TIER_SPEND_GBP } from "@/lib/bookingServiceFee";
import { formatVendorReferralCodeInput, normalizeVendorReferralCode } from "@/lib/vendorReferralAttribution";

type UseVendorReferralPreviewArgs = {
  vendorUserId: string;
  vendorPortionGbp: number;
  initialCode?: string | null;
};

export function useVendorReferralPreview({
  vendorUserId,
  vendorPortionGbp,
  initialCode,
}: UseVendorReferralPreviewArgs) {
  const [referralCode, setReferralCode] = useState(initialCode?.trim() ?? "");
  const [referralDiscountGbp, setReferralDiscountGbp] = useState(0);
  const [codeValid, setCodeValid] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPreview = useCallback(
    async (rawCode: string, portion: number) => {
      const normalized = normalizeVendorReferralCode(rawCode);
      if (!normalized) {
        setReferralDiscountGbp(0);
        setCodeValid(false);
        setError(rawCode.trim() ? "Enter a valid referral code (1–6 digits)." : null);
        return;
      }
      setValidating(true);
      setError(null);
      try {
        const preview = await fetchVendorReferralPreview(vendorUserId, normalized, portion);
        const isCodeValid = preview.code_valid;
        setCodeValid(isCodeValid);
        setReferralDiscountGbp(isCodeValid ? preview.qualified_discount_gbp : 0);
        if (!isCodeValid) {
          setError("That referral code is not valid for this vendor.");
        } else if (preview.qualified_discount_gbp <= 0) {
          setError(
            portion < REFERRAL_LOWEST_TIER_SPEND_GBP
              ? `Referral code saved. The discount applies when the vendor total is £${REFERRAL_LOWEST_TIER_SPEND_GBP}+.`
              : null,
          );
        }
      } catch {
        setReferralDiscountGbp(0);
        setCodeValid(false);
        setError("Could not check referral code. Try again.");
      } finally {
        setValidating(false);
      }
    },
    [vendorUserId],
  );

  useEffect(() => {
    if (initialCode?.trim()) {
      setReferralCode(initialCode.trim());
    }
  }, [initialCode]);

  useEffect(() => {
    if (referralCode.trim()) {
      void refreshPreview(referralCode, vendorPortionGbp);
    } else {
      setReferralDiscountGbp(0);
      setCodeValid(false);
      setError(null);
    }
  }, [referralCode, vendorPortionGbp, refreshPreview]);

  const onReferralCodeChange = (value: string) => {
    const formatted = formatVendorReferralCodeInput(value);
    setReferralCode(formatted);
    if (!formatted) {
      setReferralDiscountGbp(0);
      setCodeValid(false);
      setError(null);
    }
  };

  const onReferralCodeBlur = () => {
    if (referralCode.trim()) {
      void refreshPreview(referralCode, vendorPortionGbp);
    }
  };

  const referralApplied = codeValid && referralDiscountGbp > 0;

  return {
    referralCode,
    setReferralCode: onReferralCodeChange,
    onReferralCodeBlur,
    referralDiscountGbp,
    codeValid,
    validating,
    error,
    referralApplied,
    normalizedCode: codeValid ? normalizeVendorReferralCode(referralCode) : null,
  };
}
