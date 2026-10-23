"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { getApiErrorDetail } from "@/lib/api-errors";
import { submitAdminContact } from "@/lib/contactApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { adminBugReportSchema, parseForm } from "@/lib/validation";

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
    <div className="ez-split">
      <div className="ez-split__main">
        <section className="ez-card overflow-hidden">
          <div className="ez-card__head">
            <h2 className="ez-h3">What went wrong</h2>
          </div>
          <form onSubmit={onSubmit} className="ez-card__body ez-stack ez-stack--lg">
            {error ? <AdminErrorBanner message={error} /> : null}
            <label htmlFor="admin-bug-message" className="ez-field">
              <span className="ez-label">What did you tap, and what should have happened?</span>
              <textarea
                id="admin-bug-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="ez-input ez-input--area"
                placeholder="Describe the steps and the outcome you expected."
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="submit" className="ez-btn ez-btn--primary" disabled={busy}>
                {busy ? "Sending…" : "Send bug report"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="ez-split__aside">
        <section className="ez-card overflow-hidden lg:sticky lg:top-4">
          <div className="ez-card__head">
            <h2 className="ez-h3">Before you send</h2>
          </div>
          <div className="ez-card__body ez-lines ez-small">
            <p>
              Do not paste customer emails or card details. Use the booking reference instead, like
              EZ-20418.
            </p>
            <p>Urgent problems with money: message the on-call engineer directly.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
