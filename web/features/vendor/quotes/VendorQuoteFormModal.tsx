"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { getApiErrorDetail } from "@/lib/api-errors";
import { withMutationFeedback } from "@/lib/mutationFeedback";
import { VENDOR_BOOKING_TOAST_COPY, VENDOR_BOOKING_ERROR_COPY } from "@/features/bookings/bookingConfirmCopy";
import { todayIsoDate } from "@/lib/eventDateValidation";
import { parseSingleMoneyNumber } from "@/lib/validation/money";
import { parseForm, vendorQuoteSchema } from "@/lib/validation";
import { postVendorQuote } from "@/lib/vendorBookingsApi";
import { fetchVendorProfile } from "@/lib/vendorProfileApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

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

/** Prefill quote price from a validated onboarding package price string. */
function numericPricePrefill(raw: string): string {
  const amount = parseSingleMoneyNumber(raw);
  if (amount == null) return "";
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2);
}

const CUSTOM_OPTION_ID = "__custom__";

/** Slide-over - sending a custom quote is a step inside the chat, not a separate flow. */
export function VendorQuoteFormModal({
  isOpen,
  onClose,
  conversationId,
  clientUserId,
  quotePrefill,
}: VendorQuoteFormModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate());
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
        const raw = res.profile_form_data?.packages;
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
        /* no packages on file - falls back to the free-text option */
      });

    if (quotePrefill) {
      if (quotePrefill.eventName) setEventName(quotePrefill.eventName);
      if (quotePrefill.eventDate) setEventDate(quotePrefill.eventDate);
      if (quotePrefill.eventEndDate) setEventEndDate(quotePrefill.eventEndDate);
    }
  }, [isOpen, quotePrefill]);

  const reset = () => {
    setEventName("");
    setEventDate(todayIsoDate());
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
    const parsed = parseForm(vendorQuoteSchema, {
      eventName,
      eventDate,
      eventEndDate: eventEndDate || null,
      heading,
      price,
      notes,
      selectedPackageId,
    });
    if (!parsed.ok) {
      let msg = parsed.formError;
      if (
        parsed.fieldErrors.heading &&
        selectedPackageId !== CUSTOM_OPTION_ID &&
        packages.length > 0
      ) {
        msg = 'Choose a package, or switch to "Other" and enter a name.';
      }
      setError(msg);
      return;
    }

    const { eventName: name, eventDate: ed, eventEndDate: end, heading: packageName, price: p, notes: noteText } =
      parsed.data;

    setBusy(true);
    let caught: unknown = null;
    const out = await withMutationFeedback(showToast, {
      successTitle: VENDOR_BOOKING_TOAST_COPY.quoteSent,
      showErrorToast: false,
      run: async () => {
        try {
          const id =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `li-${Date.now()}`;
          const posted = await postVendorQuote({
            client_user_id: clientUserId,
            conversation_id: conversationId,
            event_name: name,
            event_date: ed.slice(0, 10),
            event_end_date: end?.trim() ? end.slice(0, 10) : null,
            notes: noteText || null,
            line_items: [
              {
                id,
                heading: packageName,
                unit_price_gbp: p,
              },
            ],
          });
          track(MixpanelEvents.vendor_quote_sent, {
            booking_id: posted.booking_request_id,
            conversation_id: conversationId,
            price_gbp: p,
          });
          return posted;
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (out) {
      reset();
      onClose();
      router.push(`/vendor/bookings/${encodeURIComponent(out.booking_request_id)}`);
    } else if (caught) {
      setError(getApiErrorDetail(caught) ?? VENDOR_BOOKING_ERROR_COPY.quoteFailed);
    }
    setBusy(false);
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
        <p className="text-sm leading-relaxed text-neutral-600">
          Send this client a price from chat. Use a package you already list, or enter a
          one-off amount. They can accept or decline in Bookings. This stays on their
          booking only. It won&apos;t appear on your listing.
        </p>
        {error ? <LottieFailureInline message={error} /> : null}
        <TextField
          label="Event name"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="e.g. Sarah & James - wedding reception"
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
            allowEmpty
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
