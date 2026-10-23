"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { PortalRole } from "@/lib/portalRole";
import { helpHubTabHref } from "@/lib/helpHub";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { contactFormSchema, parseForm } from "@/lib/validation";
import { submitClientContact, submitVendorContact } from "@/lib/contactApi";
import { formControlClass } from "@/components/ui/tokens";
import { RotatingContactMessagePlaceholder } from "@/features/contact/RotatingContactMessagePlaceholder";

type Props = {
  role: PortalRole;
  /** When rendered inside the Help hub, show cross-links to other tabs. */
  embedded?: boolean;
};

const fieldClass = formControlClass();

export function ContactFormView({ role, embedded = false }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseForm(contactFormSchema, { message, bookingId });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setBusy(true);
    try {
      const booking = (parsed.data.bookingId ?? "").trim() || null;
      const body = {
        message: parsed.data.message,
        booking_id: booking,
      };
      if (role === "client") {
        await submitClientContact(body);
      } else {
        await submitVendorContact(body);
      }
      track(MixpanelEvents.contact_form_submitted, { role });
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
      <section className="rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            Message the team
          </h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            We usually reply by email within two working days.
            {embedded ? (
              <>
                {" "}
                For ongoing chats with Eventtz, use the{" "}
                <Link href={helpHubTabHref(role, "messages")} className="font-medium text-primary hover:underline">
                  Messages
                </Link>{" "}
                tab.
              </>
            ) : null}
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
              className={formControlClass("bg-neutral-50 text-neutral-700")}
            />
          </div>

          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="contact-booking" className="block text-sm font-medium text-neutral-800">
              Booking reference <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <input
              id="contact-booking"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="Paste from booking details"
              className={fieldClass}
            />
          </div>

          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-800">
              Message
            </label>
            <div className="relative">
              <RotatingContactMessagePlaceholder
                role={role}
                visible={!message.trim()}
              />
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className={fieldClass}
                placeholder=""
              />
            </div>
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
