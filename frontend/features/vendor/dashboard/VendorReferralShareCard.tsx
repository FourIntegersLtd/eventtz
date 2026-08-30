"use client";

import { useEffect, useState } from "react";
import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { CopyReferralLinkButton } from "@/features/admin/referrals/CopyReferralLinkButton";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { formatBookingMoneyLabel } from "@/lib/bookingServiceFee";
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
import { VendorReferralBookingsTable } from "./VendorReferralBookingsTable";

export function VendorReferralShareCard() {
  const { showToast } = useToast();
  const [info, setInfo] = useState<VendorClientReferralInfo | null>(null);
  const [bookings, setBookings] = useState<VendorReferralBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
      .catch(() => {
        if (!cancelled) setError("Could not load your referral link.");
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
      <section className={`${portalCard} ${portalCardPadding}`}>
        <LoadingState label="Loading referral link…" />
      </section>
    );
  }

  if (error || !info) {
    return null;
  }

  const sortedTiers = [...info.tiers].sort((a, b) => a.min_spend_gbp - b.min_spend_gbp);
  const hasCode = info.has_referral_code && Boolean(info.referral_code);

  return (
    <section className={`${portalCard} ${portalCardPadding}`}>
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Client referrals</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        Share a link or a short code (up to {VENDOR_REFERRAL_CODE_MAX_LEN} digits) so clients save on
        the Eventtz booking fee ({info.service_fee_percent}% standard). You still receive your full
        quoted amount.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">Vendor total</th>
              <th className="px-4 py-2.5 text-right">Client saves on Eventtz fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedTiers.map((tier) => (
              <tr key={tier.min_spend_gbp}>
                <td className="px-4 py-2.5 text-neutral-800">
                  {formatBookingMoneyLabel(tier.min_spend_gbp)}+
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-emerald-700">
                  {formatBookingMoneyLabel(tier.fee_discount_gbp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your code</p>
        {hasCode ? (
          <p className="mt-1 font-mono text-lg font-semibold tracking-widest text-neutral-900">
            {info.referral_code}
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-600">Create a code to start sharing.</p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Custom referral code</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={VENDOR_REFERRAL_CODE_MAX_LEN}
              value={draftCode}
              onChange={(e) => setDraftCode(formatVendorReferralCodeInput(e.target.value))}
              placeholder={`1–${VENDOR_REFERRAL_CODE_MAX_LEN} digits`}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400"
            />
          </label>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving || !draftCode}
              onClick={() => void applyCode({ code: draftCode })}
            >
              Save code
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void applyCode({ generate: true })}
            >
              Generate
            </Button>
          </div>
        </div>

        {hasCode && info.share_link ? (
          <div className="mt-3 flex items-center gap-2 border-t border-neutral-200 pt-3">
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

      {bookings ? (
        <VendorReferralBookingsTable
          bookings={bookings.bookings}
          totalBookings={bookings.total_referral_bookings}
          totalSavingsGbp={bookings.total_fee_savings_gbp}
        />
      ) : null}
    </section>
  );
}
