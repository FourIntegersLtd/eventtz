"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { DescriptionList } from "@/components/ui/DescriptionList";
import type { Tone } from "@/lib/tone";
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

function statusBadge(status: string): { label: string; tone: Tone } {
  if (status === "payout_released") return { label: "Payout sent", tone: "success" };
  if (status === "paid") return { label: "Paid", tone: "success" };
  if (status === "refunded" || status === "partially_refunded") {
    return { label: status === "refunded" ? "Refunded" : "Partially refunded", tone: "info" };
  }
  return { label: status, tone: "neutral" };
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
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <Button
              variant="secondary"
              disabled={downloading}
              icon={<Download size={18} strokeWidth={1.75} aria-hidden />}
              onClick={() => void download()}
            >
              {downloading ? "Preparing…" : "Download"}
            </Button>
          </>
        }
      />

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <Card>
            <Card.Header>
              <span className="ez-h3">{statement ? "Payout" : "Payment"}</span>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </Card.Header>
            <Card.Body>
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
                <DescriptionList
                  items={[
                    { label: "Paid by", value: receipt.counterparty_name },
                    { label: "Event", value: receipt.event_date || receipt.event_name },
                    { label: "Package", value: receipt.event_name },
                    ...(receipt.payment_reference
                      ? [{ label: "Payment reference", value: receipt.payment_reference }]
                      : []),
                  ]}
                />
              )}
            </Card.Body>
          </Card>

          {!statement ? (
            <Card>
              <Card.Header>
                <span className="ez-h3">Breakdown</span>
              </Card.Header>
              <Card.Body>
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
              </Card.Body>
            </Card>
          ) : (
            <Card>
              <Card.Header>
                <span className="ez-h3">Timeline</span>
              </Card.Header>
              <Card.Body>
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
              </Card.Body>
            </Card>
          )}
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <Card>
            <Card.Header>
              <span className="ez-h3">{statement ? "Details" : "Your side"}</span>
            </Card.Header>
            <Card.Body>
              {statement ? (
                <DescriptionList
                  items={[
                    { label: "Paid to", value: receipt.counterparty_name },
                    ...(receipt.transfer_reference
                      ? [{ label: "Transfer reference", value: receipt.transfer_reference }]
                      : []),
                    ...(receipt.payout_released_at
                      ? [{ label: "Released", value: receipt.payout_released_at }]
                      : []),
                  ]}
                />
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
              {receipt.status_note ? <p className="ez-caption mt-2.5">{receipt.status_note}</p> : null}
              {statement ? null : (
                <div className="mt-3">
                  <ButtonLink variant="secondary" href={`/vendor/bookings/${bookingId}/payout-statement`}>
                    View payout statement
                  </ButtonLink>
                </div>
              )}
            </Card.Body>
          </Card>
          <Card>
            <Card.Body>
              <p className="ez-small">
                {statement
                  ? "Keep this statement for your records. Questions? Open Help and mention the booking reference."
                  : "The service fee is added on top of your price, so it never reduces what you receive."}
              </p>
              <ButtonLink variant="ghost" href="/vendor/help">
                Contact support
              </ButtonLink>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
