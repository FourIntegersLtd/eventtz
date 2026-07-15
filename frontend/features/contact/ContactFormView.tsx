"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  CONTACT_SUBJECT_OPTIONS,
  submitClientContact,
  submitVendorContact,
  type ContactSubject,
} from "@/lib/contactApi";

type Props = {
  role: PortalRole;
};

const BOOKING_SUBJECTS = new Set<ContactSubject>(["booking_problem", "payments"]);

export function ContactFormView({ role }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [subject, setSubject] = useState<ContactSubject>("general");
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showBookingId = BOOKING_SUBJECTS.has(subject);
  const disputesHref = portalRoute(role, "disputes");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError("Please enter at least 10 characters.");
      return;
    }
    if (showBookingId && !bookingId.trim()) {
      setError("Please enter your booking reference.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        subject,
        message: trimmed,
        booking_id: showBookingId ? bookingId.trim() : null,
      };
      if (role === "client") {
        await submitClientContact(body);
      } else {
        await submitVendorContact(body);
      }
      setMessage("");
      setBookingId("");
      showToast({
        tone: "success",
        title: "Message sent",
        description: "We'll get back to you by email as soon as we can.",
      });
    } catch (err) {
      setError(getApiErrorDetail(err) ?? "Could not send your message. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-neutral-600">
          Send a message to the Eventtz team. We usually reply by email within two working days.
        </p>
        <p className="text-sm text-neutral-600">
          For problems on a paid booking, you can also{" "}
          <Link href={disputesHref} className="font-medium text-primary hover:underline">
            report a problem
          </Link>{" "}
          from the booking page.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className="block text-sm font-medium text-neutral-800">
            Your email
          </label>
          <input
            id="contact-email"
            readOnly
            value={user?.email ?? ""}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contact-subject" className="block text-sm font-medium text-neutral-800">
            Subject
          </label>
          <select
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as ContactSubject)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
          >
            {CONTACT_SUBJECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {showBookingId ? (
          <TextField
            label="Booking reference"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Paste your booking reference"
            hint="You can copy this from your booking details page."
          />
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-800">
            Message
          </label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
            placeholder="How can we help?"
          />
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <Button type="submit" loading={busy}>
          Send message
        </Button>
      </form>
    </div>
  );
}
