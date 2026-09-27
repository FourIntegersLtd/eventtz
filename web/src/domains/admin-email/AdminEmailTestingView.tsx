"use client";

import { useEffect, useState } from "react";
import { Button, TextField } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { AdminErrorBanner, AdminSuccessBanner, adminCapabilities } from "@/capabilities/admin-shell";
import { validateEmailTestSend } from "@/domains/admin-email/emailTestValidation";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminEmailTemplates, sendAdminEmailTest, type AdminEmailTemplate } from "@/domains/admin-email/api";

const DEFAULT_BODY = "This is a test email from Eventtz. If you received this, Resend delivery is working.";

/**
 * `/admin/email` — confirm Resend delivery and preview email layouts.
 *
 * Super-admin only, matching `frontend/features/admin/email/AdminEmailTestingView.tsx`;
 * a plain admin sees a note instead (the nav also hides the link for them).
 */
export function AdminEmailTestingView() {
  const { session } = useSession();
  if (!adminCapabilities.canSendTestEmails(session)) {
    return (
      <p className="text-sm text-neutral-600">
        Only super admins can send test emails. Contact a super admin if you need access.
      </p>
    );
  }
  return <EmailTestingForm defaultTo={session?.user.email ?? ""} />;
}

function EmailTestingForm({ defaultTo }: { defaultTo: string }) {
  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [toEmail, setToEmail] = useState(defaultTo);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminEmailTemplates()
      .then((rows) => {
        setTemplates(rows);
        if (rows[0]) setTemplateId(rows[0].id);
      })
      .catch(() => setTemplates([]));
  }, []);

  async function handleSend() {
    const validationError = validateEmailTestSend({ templateId, toEmail, messageBody: body });
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await sendAdminEmailTest({ template_id: templateId, to_email: toEmail, message_body: body });
      setResult(response.delivered ? "Test email sent" : response.message ?? "Email was not sent.");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Email was not sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-neutral-600">
        Confirm Resend delivery and preview email layouts with your own message text.
      </p>
      <TextField label="Send to" type="email" value={toEmail} onChange={(event) => setToEmail(event.target.value)} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Message</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Email layout</span>
        <select
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className="w-full rounded-xl border border-primary-border px-3 py-2 text-sm"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <AdminErrorBanner message={error} /> : null}
      {result ? <AdminSuccessBanner message={result} /> : null}
      <Button loading={busy} onClick={() => void handleSend()} disabled={!toEmail || !templateId}>
        Send test email
      </Button>
    </div>
  );
}
