"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formControlClass } from "@/components/ui/tokens";
import {
  deleteVendorListingPause,
  postVendorWarning,
  putVendorListingPause,
  type AdminVendorRow,
} from "@/lib/adminVendorsApi";

type Props = { vendor: AdminVendorRow };

/** Staff-only cancellation record, a Warn action and a timed listing pause for one vendor. */
export function VendorConsequencesSection({ vendor }: Props) {
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [pausedUntil, setPausedUntil] = useState<string | null>(vendor.listing_paused_until ?? null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await work();
      showToast({ title: success, tone: "success" });
    } catch {
      showToast({ title: "That did not work", description: "Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">Cancellations and consequences</h3>
      <p className="text-sm text-neutral-700">
        Cancellations counted in the last 180 days: <strong>{vendor.vendor_cancellation_count ?? 0}</strong>
        {vendor.cancellation_review_flag ? (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            Review
          </span>
        ) : null}
        . Private to staff.
      </p>

      <div className="space-y-2">
        <label className="block text-sm">
          <span className="text-neutral-600">Warn vendor (emailed to them)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            className={formControlClass("mt-1")}
          />
        </label>
        <Button
          type="button"
          disabled={busy || message.trim().length < 3}
          onClick={() =>
            run(async () => {
              await postVendorWarning(vendor.user_id, message);
              setMessage("");
            }, "Warning sent")
          }
        >
          Warn vendor
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-neutral-600">
          {pausedUntil
            ? `Listing paused until ${new Date(pausedUntil).toLocaleDateString()}.`
            : "Pause the listing (it returns on its own)."}
        </p>
        <div className="flex gap-2">
          <label className="text-sm">
            <span className="text-neutral-600">Days</span>
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={formControlClass("mt-1 w-24")}
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="text-neutral-600">Reason (emailed to the vendor)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={formControlClass("mt-1")}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={busy || reason.trim().length < 3 || days < 1 || days > 90}
            onClick={() =>
              run(async () => {
                const result = await putVendorListingPause(vendor.user_id, days, reason);
                setPausedUntil(result.listing_paused_until);
              }, "Listing paused")
            }
          >
            Pause listing
          </Button>
          {pausedUntil ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await deleteVendorListingPause(vendor.user_id);
                  setPausedUntil(null);
                }, "Pause ended")
              }
            >
              End pause
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
