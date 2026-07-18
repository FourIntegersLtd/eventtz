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
import { contactFormSchema, parseForm } from "@/lib/validation";
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

const fieldClass =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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
    const parsed = parseForm(contactFormSchema, { subject, message, bookingId });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setBusy(true);
    try {
      const body = {
        subject: parsed.data.subject,
        message: parsed.data.message,
        booking_id: BOOKING_SUBJECTS.has(parsed.data.subject)
          ? (parsed.data.bookingId ?? "").trim() || null
          : null,
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
    <div className="w-full min-w-0 max-w-3xl">
      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            Message the team
          </h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            We usually reply by email within two working days. For problems on a paid booking, you
            can also{" "}
            <Link href={disputesHref} className="font-medium text-primary hover:underline">
              report a problem
            </Link>{" "}
            from the booking page.
          </p>
        </div>

        <form onSubmit={onSubmit} className="divide-y divide-neutral-100 border-t border-neutral-100">
          <div className="space-y-1.5 px-5 py-4 sm:px-6">
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

          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="contact-subject" className="block text-sm font-medium text-neutral-800">
              Subject
            </label>
            <select
              id="contact-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value as ContactSubject)}
              className={fieldClass}
            >
              {CONTACT_SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {showBookingId ? (
            <div className="px-5 py-4 sm:px-6">
              <TextField
                label="Booking reference"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="Paste your booking reference"
                hint="You can copy this from your booking details page."
              />
            </div>
          ) : null}

          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-800">
              Message
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className={fieldClass}
              placeholder="How can we help?"
            />
          </div>

          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {error ? <p className="text-sm text-red-700">{error}</p> : <span />}
            <Button type="submit" loading={busy} className="sm:shrink-0">
              Send message
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
