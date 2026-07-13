"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { getApiErrorDetail } from "@/lib/api-errors";
import { todayIsoDate, validateEventDates } from "@/lib/eventDateValidation";
import { postVendorQuote } from "@/lib/vendorBookingsApi";
import { fetchVendorProfile } from "@/lib/vendorProfileApi";

type VendorQuoteFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  clientUserId: string;
  /** Pre-fill event fields from an existing booking request in this conversation. */
  quotePrefill?: {
    eventName?: string;
    eventDate?: string;
    eventEndDate?: string;
  };
};

type VendorPackageOption = {
  id: string;
  title: string;
  price: string;
};

/** A package's `price` field is free text (e.g. "£1,200" or "1200") — pull out
 * the leading number so it's usable to prefill the quote's price field. */
function numericPricePrefill(raw: string): string {
  const match = raw.match(/[\d,]+(\.\d+)?/);
  if (!match) return "";
  return match[0].replace(/,/g, "");
}

const CUSTOM_OPTION_ID = "__custom__";

/** Slide-over — sending a custom quote is a step inside the chat, not a separate flow. */
export function VendorQuoteFormModal({
  isOpen,
  onClose,
  conversationId,
  clientUserId,
  quotePrefill,
}: VendorQuoteFormModalProps) {
  const router = useRouter();
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [packages, setPackages] = useState<VendorPackageOption[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(CUSTOM_OPTION_ID);
  const [heading, setHeading] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void fetchVendorProfile()
      .then((res) => {
        const raw = res.payload?.packages;
        if (!Array.isArray(raw)) return;
        const opts: VendorPackageOption[] = raw
          .filter(
            (p): p is Record<string, unknown> =>
              !!p && typeof p === "object" && typeof (p as Record<string, unknown>).title === "string",
          )
          .map((p) => ({
            id: String(p.id ?? p.title),
            title: String(p.title).trim(),
            price: String(p.price ?? ""),
          }))
          .filter((p) => p.title.length > 0);
        setPackages(opts);
        const first = opts[0];
        if (first) {
          setSelectedPackageId(first.id);
          setHeading(first.title);
          setPrice((prev) => prev || numericPricePrefill(first.price));
        }
      })
      .catch(() => {
        /* no packages on file — falls back to the free-text option */
      });

    if (quotePrefill) {
      if (quotePrefill.eventName) setEventName(quotePrefill.eventName);
      if (quotePrefill.eventDate) setEventDate(quotePrefill.eventDate);
      if (quotePrefill.eventEndDate) setEventEndDate(quotePrefill.eventEndDate);
    }
  }, [isOpen, quotePrefill]);

  const reset = () => {
    setEventName("");
    setEventDate("");
    setEventEndDate("");
    setSelectedPackageId(CUSTOM_OPTION_ID);
    setHeading("");
    setPrice("");
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    if (!busy) {
      reset();
      onClose();
    }
  };

  const minEventDate = todayIsoDate();

  const submit = async () => {
    setError(null);
    const name = eventName.trim();
    const ed = eventDate.trim();
    const packageName = heading.trim();
    const p = parseFloat(price.replace(/,/g, ""));
    if (!name) {
      setError("Enter an event name.");
      return;
    }
    if (!packageName) {
      setError(
        selectedPackageId === CUSTOM_OPTION_ID
          ? "Enter a package name for this quote."
          : "Choose a package, or switch to \"Other\" and enter a name.",
      );
      return;
    }
    if (!ed || ed.length < 10) {
      setError("Choose an event date.");
      return;
    }
    const dateError = validateEventDates(ed, eventEndDate);
    if (dateError) {
      setError(dateError);
      return;
    }
    if (Number.isNaN(p) || p < 0) {
      setError("Enter a valid price in GBP.");
      return;
    }

    setBusy(true);
    try {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `li-${Date.now()}`;
      const out = await postVendorQuote({
        client_user_id: clientUserId,
        conversation_id: conversationId,
        event_name: name,
        event_date: ed.slice(0, 10),
        event_end_date: eventEndDate.trim() ? eventEndDate.slice(0, 10) : null,
        notes: notes.trim() || null,
        line_items: [
          {
            id,
            heading: packageName,
            unit_price_gbp: p,
          },
        ],
      });
      reset();
      onClose();
      router.push(`/vendor/bookings/${encodeURIComponent(out.id)}`);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not send quote.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Send custom quote"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={busy}>
            Send quote
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          They can accept or decline from Bookings.
        </p>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <TextField
          label="Event name"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="e.g. Sarah & James — wedding reception"
          maxLength={500}
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <TextField
            label="Event date"
            type="date"
            min={minEventDate}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <TextField
            label="End date (optional)"
            type="date"
            min={eventDate.trim() || minEventDate}
            value={eventEndDate}
            onChange={(e) => setEventEndDate(e.target.value)}
          />
        </div>
        {packages.length > 0 ? (
          <Select
            label="Package"
            value={selectedPackageId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedPackageId(id);
              if (id === CUSTOM_OPTION_ID) {
                setHeading("");
                return;
              }
              const pkg = packages.find((p) => p.id === id);
              if (pkg) {
                setHeading(pkg.title);
                setPrice((prev) => prev || numericPricePrefill(pkg.price));
              }
            }}
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
            <option value={CUSTOM_OPTION_ID}>Other (custom quote)</option>
          </Select>
        ) : null}
        <TextField
          label="Package name *"
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          placeholder="e.g. Gold wedding package"
          maxLength={200}
          disabled={packages.length > 0 && selectedPackageId !== CUSTOM_OPTION_ID}
        />
        <TextField
          label="Price (GBP, excl. platform fee)"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 1200"
        />
        <TextArea
          label="What it covers (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Details, deliverables, exclusions…"
        />
      </div>
    </Drawer>
  );
}
