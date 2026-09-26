"use client";

import { useState } from "react";
import { Button } from "@/foundation/ui";
import { AdminErrorBanner, AdminSuccessBanner } from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { submitAdminBugReport } from "@/domains/admin-report-bug/api";

/** `/admin/report-bug` — a free-text form any admin can use to flag a problem. */
export function AdminReportBugView() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      await submitAdminBugReport(message.trim());
      setSent(true);
      setMessage("");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not send the report. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      {sent ? <AdminSuccessBanner message="Thanks — your report has been sent." /> : null}
      {error ? <AdminErrorBanner message={error} /> : null}
      <label className="block text-sm font-medium text-neutral-700">
        What went wrong?
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          className="mt-1 w-full rounded-xl border border-primary-border px-3 py-2 text-sm"
          placeholder="Describe the problem, and what you expected instead…"
        />
      </label>
      <Button loading={sending} disabled={!message.trim()} onClick={() => void handleSubmit()}>
        Send report
      </Button>
    </div>
  );
}
