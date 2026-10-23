"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchReceiptHtmlBlob, type PaymentReceipt } from "@/lib/receiptsApi";
import { getApiErrorDetail } from "@/lib/api-errors";

type VendorReceiptEzPageProps = {
  bookingId: string;
  load: (bookingId: string) => Promise<PaymentReceipt>;
};

function statusBadge(status: string): { label: string; className: string } {
  if (status === "payout_released") return { label: "Payout sent", className: "ez-badge ez-badge--success" };
  if (status === "paid") return { label: "Paid", className: "ez-badge ez-badge--success" };
  if (status === "refunded" || status === "partially_refunded") {
    return { label: status === "refunded" ? "Refunded" : "Partially refunded", className: "ez-badge ez-badge--info" };
  }
  return { label: status, className: "ez-badge ez-badge--neutral" };
}

/** Vendor payment record (V23) and payout statement (V24), from the receipt snapshot. */
export function VendorReceiptEzPage({ bookingId, load }: VendorReceiptEzPageProps) {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load(bookingId)
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorDetail(err) ?? "Could not load this document.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, load]);

  const download = useCallback(async () => {
    if (!receipt) return;
    setDownloading(true);
    try {
      const blob = await fetchReceiptHtmlBlob(bookingId, receipt.document_type);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${receipt.receipt_number}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(getApiErrorDetail(err) ?? "Could not download this document.");
    } finally {
      setDownloading(false);
    }
  }, [bookingId, receipt]);

  if (loading) return <LoadingState label="Loading…" variant="centered" />;
  if (error || !receipt) {
    return (
      <LottieFailurePanel
        title="Document unavailable"
        description={error ?? "This document is not available yet."}
      />
    );
  }

  const statement = receipt.document_type === "vendor_payout_statement";
  const badge = statusBadge(receipt.payment_status);

  return (
    <div className="ez-stack ez-stack--lg">
      <Link className="ez-back" href={`/vendor/bookings/${bookingId}`}>
        All bookings
      </Link>
      <PageHeader descriptionSize="body"
        eyebrow={statement ? "Statement" : "Receipt"}
        title={statement ? "Payout statement" : "Payment record"}
        description={`${receipt.receipt_number} · ${receipt.counterparty_name}, ${receipt.event_name}`}
        actions={
          <>
            <span className={badge.className}>{badge.label}</span>
            <button className="ez-btn ez-btn--secondary" type="button" disabled={downloading} onClick={() => void download()}>
              <Download size={18} strokeWidth={1.75} aria-hidden />
              {downloading ? "Preparing…" : "Download"}
            </button>
          </>
        }
      />

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">{statement ? "Payout" : "Payment"}</span>
              <span className={badge.className}>{badge.label}</span>
            </div>
            <div className="ez-card__body">
              {statement ? (
                <div className="ez-lines">
                  {receipt.line_items.map((line) => (
                    <div className="ez-lines__row" key={line.label}>
                      <span>{line.label}</span>
                      <span>{line.amount_label}</span>
                    </div>
                  ))}
                  <div className="ez-lines__total">
                    <span>Paid to your bank</span>
                    <span>{receipt.vendor_share_label ?? receipt.total_label}</span>
                  </div>
                </div>
              ) : (
                <dl className="ez-dl">
                  <dt>Paid by</dt>
                  <dd>{receipt.counterparty_name}</dd>
                  <dt>Event</dt>
                  <dd>{receipt.event_date || receipt.event_name}</dd>
                  <dt>Package</dt>
                  <dd>{receipt.event_name}</dd>
                  {receipt.payment_reference ? (
                    <>
                      <dt>Payment reference</dt>
                      <dd>{receipt.payment_reference}</dd>
                    </>
                  ) : null}
                </dl>
              )}
            </div>
          </div>

          {!statement ? (
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">Breakdown</span>
              </div>
              <div className="ez-card__body">
                <div className="ez-lines">
                  {receipt.line_items.map((line) => (
                    <div className="ez-lines__row" key={line.label}>
                      <span>{line.label}</span>
                      <span>{line.amount_label}</span>
                    </div>
                  ))}
                  {receipt.service_fee_label ? (
                    <div className="ez-lines__row">
                      <span>Eventtz service fee{receipt.service_fee_percent != null ? ` (${receipt.service_fee_percent}%)` : ""}</span>
                      <span>{receipt.service_fee_label}</span>
                    </div>
                  ) : null}
                  <div className="ez-lines__total">
                    <span>Total paid by client</span>
                    <span>{receipt.total_label}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">Timeline</span>
              </div>
              <div className="ez-card__body">
                <div className="ez-timeline">
                  {receipt.paid_at ? (
                    <div className="ez-tl-item ez-tl-item--done">
                      <span className="ez-tl-dot" />
                      <div className="ez-tl-body">
                        <span className="ez-tl-title">Client paid</span>
                        <span className="ez-small">{receipt.paid_at}</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="ez-tl-item ez-tl-item--done">
                    <span className="ez-tl-dot" />
                    <div className="ez-tl-body">
                      <span className="ez-tl-title">
                        {receipt.payout_released_at ? "Payout sent" : "Payout held"}
                      </span>
                      <span className="ez-small">{receipt.payout_released_at ?? receipt.status_note ?? "Waiting for completion"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">{statement ? "Details" : "Your side"}</span>
            </div>
            <div className="ez-card__body">
              {statement ? (
                <dl className="ez-dl">
                  <dt>Paid to</dt>
                  <dd>{receipt.counterparty_name}</dd>
                  {receipt.transfer_reference ? (
                    <>
                      <dt>Transfer reference</dt>
                      <dd>{receipt.transfer_reference}</dd>
                    </>
                  ) : null}
                  {receipt.payout_released_at ? (
                    <>
                      <dt>Released</dt>
                      <dd>{receipt.payout_released_at}</dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <div className="ez-lines">
                  <div className="ez-lines__row">
                    <span>Total paid by client</span>
                    <span>{receipt.total_label}</span>
                  </div>
                  {receipt.platform_fee_label ? (
                    <div className="ez-lines__row">
                      <span>Less Eventtz service fee</span>
                      <span>{receipt.platform_fee_label}</span>
                    </div>
                  ) : null}
                  <div className="ez-lines__total">
                    <span>Your payout</span>
                    <span>{receipt.vendor_share_label ?? receipt.total_label}</span>
                  </div>
                </div>
              )}
              {receipt.status_note ? <p className="ez-caption" style={{ marginTop: 10 }}>{receipt.status_note}</p> : null}
              {statement ? null : (
                <div style={{ marginTop: 12 }}>
                  <Link className="ez-btn ez-btn--secondary" href={`/vendor/bookings/${bookingId}/payout-statement`}>
                    View payout statement
                  </Link>
                </div>
              )}
            </div>
          </div>
          <div className="ez-card">
            <div className="ez-card__body">
              <p className="ez-small">
                {statement
                  ? "Keep this statement for your records. Questions? Open Help and mention the booking reference."
                  : "The service fee is added on top of your price, so it never reduces what you receive."}
              </p>
              <Link className="ez-btn ez-btn--ghost" href="/vendor/help">
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
