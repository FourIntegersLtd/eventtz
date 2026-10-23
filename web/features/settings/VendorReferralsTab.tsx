"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, Gift } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { StatTile } from "@/components/ui/StatTile";
import { TablePagination } from "@/components/ui/TablePagination";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { formatEventDate } from "@/lib/dateFormat";
import type { Tone } from "@/lib/tone";
import { useServerList, type ServerListQuery } from "@/lib/useServerList";
import {
  formatVendorReferralCodeInput,
  VENDOR_REFERRAL_CODE_MAX_LEN,
} from "@/lib/vendorReferralAttribution";
import {
  fetchVendorClientReferral,
  fetchVendorReferralBookingsPage,
  setVendorReferralCode,
  type VendorClientReferralInfo,
  type VendorReferralBookingRow,
} from "@/lib/vendorReferralsApi";
import { referralUnavailableError, withCreatedReferralCode } from "./settingsHelpers";
import { SettingsCard } from "./SettingsCards";

/** Label and tone a referral booking's status shows as. */
function referralStatusBadge(status: string): { label: string; tone: Tone } {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "accepted") {
    return { label: "Approved", tone: "success" };
  }
  if (normalized === "pending" || normalized === "quoted") {
    return { label: "In review", tone: "warning" };
  }
  return { label: status || "Invited", tone: "neutral" };
}

/** Vendor settings "Referrals" tab: the paged list of referral bookings beside the share-link card. */
export function VendorReferralsTab() {
  const { showToast } = useToast();
  const [referral, setReferral] = useState<VendorClientReferralInfo | null>(null);
  const [referralUnavailable, setReferralUnavailable] = useState(false);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [draftReferralCode, setDraftReferralCode] = useState("");
  const [referralSaving, setReferralSaving] = useState(false);

  const fetchPage = useCallback(async ({ offset, limit }: ServerListQuery<Record<string, never>>) => {
    try {
      const page = await fetchVendorReferralBookingsPage(offset, limit);
      return { items: page.bookings, total: page.total ?? page.total_referral_bookings };
    } catch (err: unknown) {
      // A 404 means the listing is not approved yet; the share card explains it, so the list stays empty.
      if (referralUnavailableError(err)) {
        setReferralUnavailable(true);
        return { items: [], total: 0 };
      }
      throw err;
    }
  }, []);
  const { items: referralRows, total, offset, limit, goNext, goPrevious } = useServerList<
    VendorReferralBookingRow,
    Record<string, never>
  >({ fetchPage, filters: {} });

  useEffect(() => {
    let cancelled = false;
    void fetchVendorClientReferral()
      .then((info) => {
        if (cancelled) return;
        setReferral(info);
        setDraftReferralCode(info.referral_code || "");
        setReferralUnavailable(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (referralUnavailableError(err)) {
          setReferralUnavailable(true);
          return;
        }
        setReferralError("Could not load your referral link.");
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copyLink = async () => {
    const link = referral?.share_link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast({ title: "Link copied", tone: "success" });
    } catch {
      showToast({ title: "Could not copy the link", tone: "error" });
    }
  };

  const createReferralCode = async () => {
    setReferralSaving(true);
    try {
      const trimmed = draftReferralCode.trim();
      const result = await setVendorReferralCode(trimmed ? { code: trimmed } : { generate: true });
      const fresh = await fetchVendorClientReferral().catch(() => null);
      setReferral(fresh ?? withCreatedReferralCode(referral, result));
      setDraftReferralCode(result.referral_code);
      showToast({ title: "Referral code created", tone: "success" });
    } catch {
      showToast({
        title: "Could not create a referral code",
        description: "Use 1 to 6 digits, or leave blank for a random code.",
        tone: "error",
      });
    } finally {
      setReferralSaving(false);
    }
  };

  const hasReferralCode = Boolean(referral?.has_referral_code && referral.referral_code);
  const approved = referralRows.filter((row) => {
    const status = row.booking_status.toLowerCase();
    return status === "accepted" || status === "completed";
  }).length;

  return (
    <div className="vendor-referrals-layout">
      <div className="ez-stack ez-stack--lg">
        <SettingsCard title="Your referrals">
          <div className="ez-grid-2">
            <StatTile label="Bookings" value={total} />
            <StatTile label="Accepted" value={approved} />
          </div>
          {referralRows.length === 0 ? (
            <p className="ez-small">No referral bookings yet. When a client books with your link, they show up here.</p>
          ) : (
            <DataTable
              aria-label="Referral bookings"
              rows={referralRows}
              getRowKey={(row) => row.booking_request_id}
              columns={[
                {
                  key: "client",
                  header: "Client",
                  kind: "strong",
                  cell: (row) => (
                    <Link href={`/vendor/settings/referrals/${row.booking_request_id}`}>
                      {row.client_display_name || "Client"}
                    </Link>
                  ),
                },
                { key: "event", header: "Event", cell: (row) => row.event_name },
                {
                  key: "date",
                  header: "Date",
                  cell: (row) => (row.event_date ? formatEventDate(row.event_date) : "-"),
                },
                {
                  key: "status",
                  header: "Status",
                  kind: "status",
                  cell: (row) => {
                    const badge = referralStatusBadge(row.booking_status);
                    return <Badge tone={badge.tone}>{badge.label}</Badge>;
                  },
                },
              ]}
            />
          )}
          <TablePagination
            offset={offset}
            limit={limit}
            total={total}
            onPrevious={goPrevious}
            onNext={goNext}
          />
        </SettingsCard>

        <Card>
          <Card.Body>
            <div className="ez-hrow">
              <Gift size={20} strokeWidth={1.75} aria-hidden />
              <div className="ez-small">The client’s fee discount applies when they book with your code.</div>
            </div>
          </Card.Body>
        </Card>
      </div>

      <div className="vendor-referrals-layout__share">
        <SettingsCard title="Refer a client" bodyClassName="ez-stack">
          {referralLoading ? (
            <LoadingState label="Loading referral link…" variant="inline" />
          ) : referralUnavailable ? (
            <p className="ez-small">Client referrals are available after Eventtz approves your listing.</p>
          ) : referralError ? (
            <LottieFailureInline message={referralError} />
          ) : hasReferralCode ? (
            <>
              <p className="ez-small">
                Share your link. When a client books with you through it, they save on the Eventtz service fee.
              </p>
              <p className="ez-strong tracking-[0.12em] font-mono">
                {referral?.referral_code}
              </p>
              {referral?.share_link ? (
                <TextField label="Your link" value={referral.share_link} readOnly onChange={() => undefined} />
              ) : null}
              <div className="ez-hrow">
                <Button
                  variant="secondary"
                  className="ml-auto"
                  icon={<Copy size={18} strokeWidth={1.75} aria-hidden />}
                  disabled={!referral?.share_link}
                  onClick={() => void copyLink()}
                >
                  Copy link
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="ez-small">
                Choose a code once. It cannot be changed later. Leave blank for a random 6-digit code.
              </p>
              <TextField
                label="Referral code (optional)"
                value={draftReferralCode}
                inputMode="numeric"
                maxLength={VENDOR_REFERRAL_CODE_MAX_LEN}
                placeholder={`Random, or 1–${VENDOR_REFERRAL_CODE_MAX_LEN} digits`}
                onChange={({ target: { value } }) => setDraftReferralCode(formatVendorReferralCodeInput(value))}
              />
              <div className="ez-hrow">
                <Button
                  variant="secondary"
                  className="ml-auto"
                  disabled={referralSaving}
                  onClick={() => void createReferralCode()}
                >
                  {referralSaving ? "Creating…" : "Create referral code"}
                </Button>
              </div>
            </>
          )}
        </SettingsCard>
      </div>
    </div>
  );
}
