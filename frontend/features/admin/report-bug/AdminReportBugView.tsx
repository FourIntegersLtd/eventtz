"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formControlClass } from "@/components/ui/tokens";
import { getApiErrorDetail } from "@/lib/api-errors";
import { submitAdminContact } from "@/lib/contactApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { adminBugReportSchema, parseForm } from "@/lib/validation";

const fieldClass = formControlClass();

export function AdminReportBugView() {
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseForm(adminBugReportSchema, { message });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setBusy(true);
    try {
      await submitAdminContact(parsed.data.message);
      track(MixpanelEvents.contact_form_submitted, {
        role: "admin",
        subject: "feedback_bug",
      });
      setMessage("");
      showToast({
        tone: "success",
        title: "Bug sent",
        description: "We'll look at it and start a fix if we can.",
      });
    } catch (err) {
      setError(getApiErrorDetail(err) ?? "Could not send your bug report. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <section className="rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            Report a bug
          </h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            Describe what you clicked, what you expected, and what happened. Include a booking
            reference if it is about a booking.
          </p>
        </div>

        <form onSubmit={onSubmit} className="divide-y divide-neutral-100 border-t border-neutral-100">
          <div className="space-y-1.5 px-5 py-4 sm:px-6">
            <label htmlFor="admin-bug-message" className="block text-sm font-medium text-neutral-800">
              What went wrong
            </label>
            <textarea
              id="admin-bug-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className={fieldClass}
              placeholder="What did you tap, and what should have happened?"
            />
          </div>

          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {error ? <p className="text-sm text-red-700">{error}</p> : <span />}
            <Button type="submit" loading={busy} className="sm:shrink-0">
              Send to engineering
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
