"use client";

import { useEffect, useState } from "react";
import { CopyReferralLinkButton } from "@/features/admin/referrals/CopyReferralLinkButton";
import { Button } from "@/components/ui/Button";
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

const SECTION_DESCRIPTION = (
  <>
    Share a link or a short code (up to {VENDOR_REFERRAL_CODE_MAX_LEN} digits) so clients save on the
    Eventtz booking fee. You still receive your full quoted amount.
  </>
);

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
        if (isHttpStatus(err, 404)) {
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

  const applyCode = async (input: { code?: string; generate?: boolean }) => {
    setSaving(true);
    try {
      const result = await setVendorReferralCode(input);
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              referral_code: result.referral_code,
              has_referral_code: true,
              share_link: result.share_link,
            }
          : prev,
      );
      setDraftCode(result.referral_code);
      showToast({
        title: "Referral code saved",
        description: "Share the link or code with your clients.",
        tone: "success",
      });
    } catch {
      showToast({
        title: "Could not save code",
        description: "Use 1 to 6 digits, or generate a random code.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SettingsSection title="Client referrals" description={SECTION_DESCRIPTION}>
        <div className="px-5 py-5 sm:px-6">
          <LoadingState label="Loading referral link…" variant="inline" />
        </div>
      </SettingsSection>
    );
  }

  if (unavailable) {
    return (
      <SettingsSection title="Client referrals" description={SECTION_DESCRIPTION}>
        <p className="px-5 py-4 text-sm text-neutral-600 sm:px-6">
          Client referrals are available after Eventtz approves your listing.
        </p>
      </SettingsSection>
    );
  }

  if (error || !info) {
    return (
      <SettingsSection title="Client referrals" description={SECTION_DESCRIPTION}>
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
      <SettingsSection
        title="Client referrals"
        description={
          <>
            Share a link or a short code (up to {VENDOR_REFERRAL_CODE_MAX_LEN} digits) so clients save
            on the Eventtz booking fee ({info.service_fee_percent}% standard). You still receive your
            full quoted amount.
          </>
        }
      >
        <div className="overflow-hidden border-t border-neutral-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-2.5 sm:px-6">Vendor total</th>
                <th className="px-5 py-2.5 text-right sm:px-6">Client saves on Eventtz fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedTiers.map((tier) => (
                <tr key={tier.min_spend_gbp}>
                  <td className="px-5 py-2.5 text-neutral-800 sm:px-6">
                    {formatBookingMoneyLabel(tier.min_spend_gbp)}+
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums text-emerald-700 sm:px-6">
                    {formatBookingMoneyLabel(tier.fee_discount_gbp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your code</p>
          {hasCode ? (
            <p className="mt-1 font-mono text-lg font-semibold tracking-widest text-neutral-900">
              {info.referral_code}
            </p>
          ) : (
            <p className="mt-1 text-sm text-neutral-600">Create a code to start sharing.</p>
          )}

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <TextField
                label="Custom referral code"
                inputMode="numeric"
                maxLength={VENDOR_REFERRAL_CODE_MAX_LEN}
                value={draftCode}
                onChange={(e) => setDraftCode(formatVendorReferralCodeInput(e.target.value))}
                placeholder={`1–${VENDOR_REFERRAL_CODE_MAX_LEN} digits`}
                className="font-mono"
              />
            </div>
            <div className="flex shrink-0 gap-2 sm:mb-0.5">
              <Button
                type="button"
                variant="secondary"
                loading={saving}
                disabled={!draftCode}
                onClick={() => void applyCode({ code: draftCode })}
              >
                Save code
              </Button>
              <Button type="button" loading={saving} onClick={() => void applyCode({ generate: true })}>
                Generate
              </Button>
            </div>
          </div>

          {hasCode && info.share_link ? (
            <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4">
              <p className="min-w-0 flex-1 truncate text-sm text-neutral-700" title={info.share_link}>
                {info.share_link}
              </p>
              <CopyReferralLinkButton
                link={info.share_link}
                onCopied={() =>
                  showToast({
                    title: "Link copied",
                    description: "Clients can also enter your code when booking.",
                    tone: "success",
                  })
                }
              />
            </div>
          ) : null}
        </div>
      </SettingsSection>

      {bookings ? (
        <SettingsSection
          title="Referral bookings"
          description={`${bookingCount} booking${bookingCount === 1 ? "" : "s"} · ${formatBookingMoneyLabel(totalSavings)} saved for clients`}
        >
          <div className="border-t border-neutral-100">
            <SettingsReferralBookingsTable bookings={bookings.bookings} />
          </div>
        </SettingsSection>
      ) : null}
    </>
  );
}
