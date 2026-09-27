"use client";

import { useState, type FormEvent } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { useSession } from "@/foundation/session";
import { Button, Card } from "@/foundation/ui";
import { submitVendorContact } from "@/domains/vendor-contact/api";

/**
 * `/vendor/contact` — a message to the Eventtz team, optionally tied to a
 * booking. Ported (simplified) from the baseline's `ContactFormView`.
 */
export function ContactView() {
  const { session } = useSession();
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Enter a message before sending.");
      return;
    }
    setSending(true);
    setError(null);
    setSent(false);
    try {
      await submitVendorContact({ message: trimmedMessage, booking_id: bookingId.trim() || null });
      setMessage("");
      setBookingId("");
      setSent(true);
    } catch (cause: unknown) {
      setError(platformErrorDetail(cause) ?? "Could not send your message. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-neutral-900">Contact us</h1>

      <Card>
        <p className="text-sm text-neutral-500">We usually reply by email within two working days.</p>

        <form onSubmit={(event) => void onSubmit(event)} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Your email</span>
            <input readOnly value={session?.user.email ?? ""} className="w-full rounded-xl border border-primary-border bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Booking reference <span className="font-normal text-neutral-500">(optional)</span>
            </span>
            <input
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
              placeholder="Paste from booking details"
              className="w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              className="w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
            />
          </label>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {sent ? <p className="text-sm text-emerald-700">Message sent — we&apos;ll reply by email.</p> : null}

          <Button type="submit" loading={sending}>
            Send message
          </Button>
        </form>
      </Card>
    </div>
  );
}
