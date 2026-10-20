"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CopyToClipboardButton } from "@/components/ui/CopyToClipboardButton";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { TextField } from "@/components/ui/TextField";
import { formatBookingMoneyLabel } from "@/lib/bookingServiceFee";
import { isHttpStatus } from "@/lib/api-errors";
import {
  formatVendorReferralCodeInput,
  VENDOR_REFERRAL_CODE_MAX_LEN,
} from "@/lib/vendorReferralAttribution";
import {
  fetchVendorClientReferral,
  fetchVendorReferralBookings,
  setVendorReferralCode,
  type VendorClientReferralInfo,
  type VendorReferralBookingsResponse,
} from "@/lib/vendorReferralsApi";
import { useToast } from "@/components/ui/Toast";
import { SettingsReferralBookingsTable } from "./SettingsReferralBookingsTable";
import { SettingsSection } from "./SettingsSection";

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

export function SettingsReferralsSection() {
  const { showToast } = useToast();
  const [info, setInfo] = useState<VendorClientReferralInfo | null>(null);
  const [bookings, setBookings] = useState<VendorReferralBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [referralInfo, referralBookings] = await Promise.all([
      fetchVendorClientReferral(),
      fetchVendorReferralBookings(),
    ]);
    setInfo(referralInfo);
    setBookings(referralBookings);
    setDraftCode(referralInfo.referral_code || "");
  };

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((err: unknown) => {
        if (cancelled) return;
        if (referralUnavailableError(err)) {
          setUnavailable(true);
          return;
        }
        setError("Could not load your referral link.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createCode = async () => {
    setSaving(true);
    try {
      const trimmed = draftCode.trim();
      const result = await setVendorReferralCode(
        trimmed ? { code: trimmed } : { generate: true },
      );
      setInfo((prev) => withCreatedReferralCode(prev, result));
      setDraftCode(result.referral_code);
      const referralBookings = await fetchVendorReferralBookings();
      setBookings(referralBookings);
      showToast({ title: "Referral code created", tone: "success" });
    } catch {
      showToast({
        title: "Could not create code",
        description: "Use 1 to 6 digits, or leave blank for a random code.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToast = (title: string) => {
    showToast({ title, tone: "success" });
  };

  if (loading) {
    return (
      <SettingsSection title="Client referrals">
        <div className="px-5 py-5 sm:px-6">
          <LoadingState label="Loading referral link…" variant="inline" />
        </div>
      </SettingsSection>
    );
  }

  if (unavailable) {
    return (
      <SettingsSection title="Client referrals">
        <p className="px-5 py-4 text-sm text-neutral-600 sm:px-6">
          Client referrals are available after Eventtz approves your listing.
        </p>
      </SettingsSection>
    );
  }

  if (error || !info) {
    return (
      <SettingsSection title="Client referrals">
        <div className="px-5 py-4 sm:px-6">
          <LottieFailureInline message={error ?? "Could not load your referral link."} />
        </div>
      </SettingsSection>
    );
  }

  const sortedTiers = [...info.tiers].sort((a, b) => a.min_spend_gbp - b.min_spend_gbp);
  const hasCode = info.has_referral_code && Boolean(info.referral_code);
  const bookingCount = bookings?.total_referral_bookings ?? 0;
  const totalSavings = bookings?.total_fee_savings_gbp ?? 0;

  return (
    <>
      <SettingsSection title="Client referrals">
        <div className="overflow-hidden border-t border-neutral-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-2.5 sm:px-6">Booking total</th>
                <th className="px-5 py-2.5 sm:px-6">Client saves</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedTiers.map((tier) => (
                <tr key={tier.min_spend_gbp}>
                  <td className="px-5 py-2.5 text-neutral-800 sm:px-6">
                    {formatBookingMoneyLabel(tier.min_spend_gbp)}+
                  </td>
                  <td className="px-5 py-2.5 font-medium tabular-nums text-emerald-700 sm:px-6">
                    {formatBookingMoneyLabel(tier.fee_discount_gbp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 border-t border-neutral-100 px-5 py-4 sm:px-6">
          {hasCode ? (
            <>
              <div className="flex items-center gap-2">
                <p className="font-mono text-2xl font-semibold tracking-widest text-neutral-900">
                  {info.referral_code}
                </p>
                <CopyToClipboardButton
                  text={info.referral_code}
                  ariaLabel="Copy referral code"
                  onCopied={() => copyToast("Code copied")}
                />
              </div>
              {info.share_link ? (
                <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 ring-1 ring-neutral-100">
                  <p className="min-w-0 flex-1 truncate text-sm text-neutral-700" title={info.share_link}>
                    {info.share_link}
                  </p>
                  <CopyToClipboardButton
                    text={info.share_link}
                    ariaLabel="Copy referral link"
                    onCopied={() => copyToast("Link copied")}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                Choose a code once. It cannot be changed later. Leave blank for a random 6-digit code.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <TextField
                    label="Referral code (optional)"
                    inputMode="numeric"
                    maxLength={VENDOR_REFERRAL_CODE_MAX_LEN}
                    value={draftCode}
                    onChange={(e) => setDraftCode(formatVendorReferralCodeInput(e.target.value))}
                    placeholder={`Random, or 1–${VENDOR_REFERRAL_CODE_MAX_LEN} digits`}
                    className="font-mono"
                  />
                </div>
                <Button type="button" loading={saving} onClick={() => void createCode()}>
                  Create code
                </Button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {bookings ? (
        <SettingsSection
          title="Referral bookings"
          description={`${bookingCount} booking${bookingCount === 1 ? "" : "s"} · ${formatBookingMoneyLabel(totalSavings)} saved for clients`}
        >
          <div className="border-t border-neutral-100">
            <SettingsReferralBookingsTable
              bookings={bookings.bookings}
              currentReferralCode={info.referral_code}
            />
          </div>
        </SettingsSection>
      ) : null}
    </>
  );
}
