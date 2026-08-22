"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import {
  FEEDBACK_SUBJECT_OPTIONS,
  submitClientContact,
  submitVendorContact,
  type FeedbackSubject,
} from "@/lib/contactApi";
import { feedbackFormSchema, parseForm } from "@/lib/validation";
import { formControlClass } from "@/components/ui/tokens";

type Props = {
  role: PortalRole;
};

const fieldClass = formControlClass();

export function FeedbackFormView({ role }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [subject, setSubject] = useState<FeedbackSubject>("feedback_general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseForm(feedbackFormSchema, { subject, message });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setBusy(true);
    try {
      const body = {
        subject: parsed.data.subject,
        message: parsed.data.message,
        booking_id: null,
      };
      if (role === "client") {
        await submitClientContact(body);
      } else {
        await submitVendorContact(body);
      }
      track(MixpanelEvents.contact_form_submitted, {
        role,
        subject: parsed.data.subject,
        form: "feedback",
      });
      setMessage("");
      showToast({
        tone: "success",
        title: "Feedback sent",
        description: "Thanks — we read every submission.",
      });
    } catch (err) {
      setError(getApiErrorDetail(err) ?? "Could not send your feedback. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-3xl">
      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            Share feedback
          </h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            Tell us what&apos;s working, what isn&apos;t, or what you&apos;d like to see next. This
            isn&apos;t for urgent booking or payment issues — use the Contact tab for those.
          </p>
        </div>

        <form onSubmit={onSubmit} className="divide-y divide-neutral-100 border-t border-neutral-100">
          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="feedback-email" className="block text-sm font-medium text-neutral-800">
              Your email
            </label>
            <input
              id="feedback-email"
              readOnly
              value={user?.email ?? ""}
              className={formControlClass("bg-neutral-50 text-neutral-700")}
            />
          </div>

          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="feedback-category" className="block text-sm font-medium text-neutral-800">
              Category
            </label>
            <select
              id="feedback-category"
              value={subject}
              onChange={(e) => setSubject(e.target.value as FeedbackSubject)}
              className={fieldClass}
            >
              {FEEDBACK_SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="feedback-message" className="block text-sm font-medium text-neutral-800">
              Message
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className={fieldClass}
              placeholder="What should we know?"
            />
          </div>

          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {error ? <p className="text-sm text-red-700">{error}</p> : <span />}
            <Button type="submit" loading={busy} className="sm:shrink-0">
              Send feedback
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
