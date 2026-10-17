"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formControlClass } from "@/components/ui/tokens";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  deleteVendorInsurance,
  putVendorInsurance,
  type AdminVendorInsurance,
  type AdminVendorRow,
} from "@/lib/adminVendorsApi";

type Props = { vendor: AdminVendorRow };

// The least cover staff accept; the api enforces the same figure (`MIN_COVER_GBP`).
const MIN_COVER_GBP = 1_000_000;

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  missing: { label: "No certificate", tone: "bg-neutral-100 text-neutral-800" },
  awaiting_check: { label: "Awaiting check", tone: "bg-amber-100 text-amber-900" },
  verified: { label: "Checked", tone: "bg-emerald-100 text-emerald-900" },
  expiring: { label: "Ends within 30 days", tone: "bg-amber-100 text-amber-900" },
  expired: { label: "Ended", tone: "bg-red-100 text-red-900" },
};

/** Format an ISO date (`2027-03-01`) for staff, without shifting it across time zones. */
function formatDay(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Staff check of the vendor's public liability certificate: record its expiry and cover, or withdraw it. */
export function VendorInsuranceSection({ vendor }: Props) {
  const { showToast } = useToast();
  const [insurance, setInsurance] = useState<AdminVendorInsurance | undefined>(vendor.insurance);
  const [expiresOn, setExpiresOn] = useState(vendor.insurance?.expires_on ?? "");
  const [coverGbp, setCoverGbp] = useState(vendor.insurance?.cover_gbp ?? MIN_COVER_GBP);
  const [busy, setBusy] = useState(false);

  if (!insurance) return null;

  const run = async (
    work: () => Promise<{ insurance: AdminVendorInsurance; listing_visible: boolean }>,
    success: string,
  ) => {
    setBusy(true);
    try {
      const result = await work();
      setInsurance(result.insurance);
      showToast({
        title: success,
        description: result.listing_visible ? "The listing is live." : "The listing is not live.",
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: "That did not work",
        description: getApiErrorDetail(error) ?? "Try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const status = STATUS_LABELS[insurance.status] ?? STATUS_LABELS.missing;
  const checkedFile = insurance.verified_certificate_url;
  const canVerify = Boolean(insurance.certificate_url) && Boolean(expiresOn) && coverGbp >= MIN_COVER_GBP;

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">Public liability insurance</h3>
      <p className="text-sm text-neutral-700">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>
          {status.label}
        </span>
        <span className="ml-2">
          {insurance.required
            ? "Required for this vendor's services: they cannot be approved or stay listed without checked cover."
            : "Optional for this vendor; a checked certificate earns the badge."}
        </span>
      </p>

      <ul className="space-y-1 text-sm text-neutral-700">
        <li>
          Uploaded:{" "}
          {insurance.certificate_url ? (
            <a
              href={insurance.certificate_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-900 underline"
            >
              Open certificate
            </a>
          ) : (
            "nothing yet"
          )}
        </li>
        {checkedFile && insurance.expires_on ? (
          <li>
            Checked: £{(insurance.cover_gbp ?? 0).toLocaleString("en-GB")} cover until{" "}
            {formatDay(insurance.expires_on)}
            {checkedFile !== insurance.certificate_url ? " (an older file; the new upload needs checking)" : ""}.
          </li>
        ) : null}
        {insurance.required && insurance.listing_hidden_from ? (
          <li>The listing hides itself from {formatDay(insurance.listing_hidden_from)} unless a newer certificate is checked.</li>
        ) : null}
      </ul>

      <div className="flex flex-wrap gap-2">
        <label className="text-sm">
          <span className="text-neutral-600">Cover ends on</span>
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={formControlClass("mt-1")}
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-600">Cover (£)</span>
          <input
            type="number"
            min={MIN_COVER_GBP}
            step={100_000}
            value={coverGbp}
            onChange={(e) => setCoverGbp(Number(e.target.value))}
            className={formControlClass("mt-1 w-40")}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={busy || !canVerify}
          onClick={() => run(() => putVendorInsurance(vendor.user_id, expiresOn, coverGbp), "Certificate checked")}
        >
          Mark certificate checked
        </Button>
        {checkedFile ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => run(() => deleteVendorInsurance(vendor.user_id), "Check withdrawn")}
          >
            Withdraw check
          </Button>
        ) : null}
      </div>
    </section>
  );
}
