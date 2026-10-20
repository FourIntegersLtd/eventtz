"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formControlClass } from "@/components/ui/tokens";
import { adminFilterControlClass } from "@/features/admin/components/adminFilterControlClass";
import {
  deleteVendorListingPause,
  postVendorWarning,
  putVendorListingPause,
  type AdminVendorRow,
} from "@/lib/adminVendorsApi";

type Props = { vendor: AdminVendorRow };

type ConsequenceAction = "warn" | "pause";

/** Staff-only cancellation stats plus one consequence action (warn or timed pause). */
export function VendorConsequencesSection({ vendor }: Props) {
  const { showToast } = useToast();
  const [action, setAction] = useState<ConsequenceAction>("warn");
  const [message, setMessage] = useState("");
  const [days, setDays] = useState(7);
  const [pausedUntil, setPausedUntil] = useState<string | null>(vendor.listing_paused_until ?? null);
  const [busy, setBusy] = useState(false);

  const trimmedMessage = message.trim();
  const canSubmit =
    !busy &&
    trimmedMessage.length >= 3 &&
    (action === "warn" || (days >= 1 && days <= 90));

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

  const submit = () => {
    if (!canSubmit) return;
    if (action === "warn") {
      void run(async () => {
        await postVendorWarning(vendor.user_id, trimmedMessage);
        setMessage("");
      }, "Warning sent");
      return;
    }
    void run(async () => {
      const result = await putVendorListingPause(vendor.user_id, days, trimmedMessage);
      setPausedUntil(result.listing_paused_until);
      setMessage("");
    }, "Listing paused");
  };

  return (
    <section className="ez-card overflow-hidden">
      <div className="ez-card__head">
        <div className="min-w-0">
          <h2 className="ez-h3">Cancellations and consequences</h2>
          <p className="ez-small mt-1">
            Cancellations in the last 180 days:{" "}
            <strong className="font-semibold text-neutral-800">
              {vendor.vendor_cancellation_count ?? 0}
            </strong>
            {vendor.cancellation_review_flag ? (
              <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                Review
              </span>
            ) : null}
            . Private to staff.
          </p>
        </div>
      </div>

      <div className="ez-card__body">
        {pausedUntil ? (
          <div className="ez-banner ez-banner--warning mb-4">
            <div className="ez-banner__body">
              <p className="text-sm text-neutral-800">
                Listing paused until{" "}
                {new Date(pausedUntil).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                . It returns on its own after that.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await deleteVendorListingPause(vendor.user_id);
                    setPausedUntil(null);
                  }, "Pause ended")
                }
              >
                End pause early
              </Button>
            </div>
          </div>
        ) : null}

        <form
          className="ez-stack max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="ez-field block min-w-0">
            <span className="ez-label">Action</span>
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as ConsequenceAction)}
              className={`${adminFilterControlClass} ez-select max-w-md`}
              aria-label="Consequence action"
            >
              <option value="warn">Warn vendor (email only)</option>
              <option value="pause">Pause listing (hide from explore)</option>
            </select>
          </label>

          {action === "pause" ? (
            <label className="ez-field block max-w-[8rem]">
              <span className="ez-label">Days</span>
              <input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className={formControlClass()}
                aria-label="Pause duration in days"
              />
            </label>
          ) : null}

          <label className="ez-field block min-w-0">
            <span className="ez-label">
              {action === "warn" ? "Message (emailed to the vendor)" : "Reason (emailed to the vendor)"}
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              maxLength={2000}
              className={formControlClass()}
              placeholder={
                action === "warn"
                  ? "What the vendor needs to improve or fix"
                  : "Why the listing is being paused"
              }
            />
          </label>

          <div>
            <Button type="submit" disabled={!canSubmit}>
              {action === "warn" ? "Warn vendor" : "Pause listing"}
            </Button>
          </div>
        </form>

        <p className="ez-small mt-4 max-w-xl text-neutral-500">
          To permanently ban a vendor, use <strong className="font-medium text-neutral-700">Marketplace status</strong>{" "}
          above. Pauses are temporary and lift automatically.
        </p>
      </div>
    </section>
  );
}
