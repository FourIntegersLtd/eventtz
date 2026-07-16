"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { adminCard } from "@/features/admin/adminTheme";
import {
  fetchAdminEmailTemplates,
  sendAdminEmailTest,
  type AdminEmailTemplate,
} from "@/lib/adminEmailApi";
import { isSuperAdmin } from "@/lib/adminRole";
import { getApiErrorDetail } from "@/lib/api-errors";
import { adminEmailTestSchema, parseForm } from "@/lib/validation";

function groupTemplates(templates: AdminEmailTemplate[]) {
  const order = ["Marketing", "Account", "Booking", "Admin alerts"];
  const byCategory = new Map<string, AdminEmailTemplate[]>();
  for (const t of templates) {
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }
  const categories = [
    ...order.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !order.includes(c)).sort(),
  ];
  return categories.map((category) => ({
    category,
    templates: (byCategory.get(category) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

export function AdminEmailTestingView() {
  const { user } = useAuth();
  const canUse = isSuperAdmin(user);

  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [emailInitialized, setEmailInitialized] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const grouped = useMemo(() => groupTemplates(templates), [templates]);
  const selected = templates.find((t) => t.id === templateId) ?? null;

  const load = useCallback(async () => {
    if (!canUse) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const list = await fetchAdminEmailTemplates();
      setTemplates(list);
      if (list.length > 0) {
        setTemplateId((prev) => prev || list[0]!.id);
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load email templates.");
    } finally {
      setLoading(false);
    }
  }, [canUse]);

  useEffect(() => {
    void load();
  }, [load]);

  // Seed once from the signed-in admin email; never overwrite while they type or clear.
  useEffect(() => {
    if (emailInitialized) return;
    if (user?.email) {
      setToEmail(user.email);
      setEmailInitialized(true);
    }
  }, [user?.email, emailInitialized]);

  const sendTest = async () => {
    if (sending) return;
    const parsed = parseForm(adminEmailTestSchema, {
      templateId,
      toEmail,
    });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await sendAdminEmailTest({
        template_id: parsed.data.templateId,
        to_email: parsed.data.toEmail,
      });
      if (result.delivered) {
        setSuccess(result.message ?? `Sent to ${parsed.data.toEmail}.`);
      } else {
        setError(result.message ?? "Email was not sent.");
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not send test email.");
    } finally {
      setSending(false);
    }
  };

  if (!canUse) {
    return (
      <p className="text-sm text-neutral-600">
        Only super admins can send test emails. Contact a super admin if you need access.
      </p>
    );
  }

  if (loading) {
    return <AdminLoadingState label="Loading templates…" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader subtitle="Send a sample of any Eventtz email template to an inbox you control." />

      <div className={`${adminCard} max-w-xl space-y-5 p-5`}>
        {error ? <AdminErrorBanner message={error} /> : null}
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {success}
          </p>
        ) : null}

        <Select
          label="Template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {grouped.map(({ category, templates: items }) => (
            <optgroup key={category} label={category}>
              {items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>

        {selected?.description ? (
          <p className="text-sm text-neutral-500">{selected.description}</p>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="admin-email-test-to" className="block text-sm font-medium text-neutral-800">
            Send to
          </label>
          <div className="flex gap-2">
            <input
              id="admin-email-test-to"
              type="text"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="name@example.com"
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {toEmail ? (
              <button
                type="button"
                onClick={() => setToEmail("")}
                className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className="text-xs text-neutral-500">
            Any inbox. Replace the address above or clear it and type a new one.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => void sendTest()}
          loading={sending}
          disabled={!templateId || !toEmail.trim()}
          icon={<Mail className="h-4 w-4" aria-hidden />}
        >
          Send test email
        </Button>
      </div>
    </div>
  );
}
