"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Info, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  ADMIN_MESSAGE_BODY_HINT,
  EMAIL_HEALTH_FIELD_HINTS,
  emailHealthLayoutInfo,
} from "@/features/admin/email/emailHealthCopy";
import {
  isSupportDraftValid,
  supportDraftFromPlainText,
  SupportMessageComposer,
} from "@/features/admin/messages/SupportMessageComposer";
import type { SupportRichTextChange } from "@/features/admin/messages/SupportRichTextEditor";
import {
  ADMIN_EMAIL_HEALTH_TEMPLATE_ID,
  DEFAULT_ADMIN_EMAIL_TEST_BODY,
  fetchAdminEmailTemplates,
  sendAdminEmailTest,
  type AdminEmailTemplate,
} from "@/lib/adminEmailApi";
import { isSuperAdmin } from "@/lib/adminRole";
import { getApiErrorDetail } from "@/lib/api-errors";
import { adminEmailTestSchema, parseForm } from "@/lib/validation";

function groupTemplates(templates: AdminEmailTemplate[]) {
  const order = ["Recommended", "Layout preview"];
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

function LayoutInfoPanel({ templateId }: { templateId: string }) {
  const info = emailHealthLayoutInfo(templateId);
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.03] px-4 py-3">
      <p className="text-sm font-medium text-neutral-900">{info.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{info.summary}</p>
      <p className="mt-2 text-[13px] font-medium text-neutral-800">{info.whenToUse}</p>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Examples</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-[13px] text-neutral-600">
        {info.realWorldExamples.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
    </div>
  );
}

export function AdminEmailTestingView() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canUse = isSuperAdmin(user);

  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState(ADMIN_EMAIL_HEALTH_TEMPLATE_ID);
  const [toEmail, setToEmail] = useState("");
  const [messageDraft, setMessageDraft] = useState<SupportRichTextChange>(() =>
    supportDraftFromPlainText(DEFAULT_ADMIN_EMAIL_TEST_BODY),
  );
  const [messageEditorKey, setMessageEditorKey] = useState(0);
  const [emailInitialized, setEmailInitialized] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const grouped = useMemo(() => groupTemplates(templates), [templates]);
  const activeTemplateId = showAdvanced ? templateId : ADMIN_EMAIL_HEALTH_TEMPLATE_ID;

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
        setTemplateId((prev) => prev || ADMIN_EMAIL_HEALTH_TEMPLATE_ID);
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load email layouts.");
    } finally {
      setLoading(false);
    }
  }, [canUse]);

  useEffect(() => {
    void load();
  }, [load]);

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
      templateId: activeTemplateId,
      toEmail,
      messageHtml: messageDraft.html,
      textLength: messageDraft.textLength,
    });
    if (!parsed.ok) {
      const message = parsed.formError;
      setError(message);
      showToast({ title: "Check the form", description: message, tone: "error" });
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await sendAdminEmailTest({
        template_id: parsed.data.templateId,
        to_email: parsed.data.toEmail,
        message_body_html: parsed.data.messageHtml,
      });
      if (result.delivered) {
        const message = result.message ?? `Sent to ${parsed.data.toEmail}.`;
        setSuccess(message);
        showToast({
          title: "Test email sent",
          description: message,
          tone: "success",
        });
        setMessageDraft(supportDraftFromPlainText(DEFAULT_ADMIN_EMAIL_TEST_BODY));
        setMessageEditorKey((k) => k + 1);
      } else {
        const message = result.message ?? "Email was not sent.";
        setError(message);
        showToast({ title: "Email not sent", description: message, tone: "error" });
      }
    } catch (e: unknown) {
      const message = getApiErrorDetail(e) ?? "Could not send test email.";
      setError(message);
      showToast({ title: "Email not sent", description: message, tone: "error" });
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
    return <AdminLoadingState label="Loading email tools…" />;
  }

  return (
    <div className="w-full min-w-0 max-w-5xl space-y-6">
      <AdminPageHeader subtitle="Confirm Resend delivery and preview email layouts with your own message text." />

      {error ? <AdminErrorBanner message={error} /> : null}
      {success ? <p className="text-sm font-medium text-primary">{success}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Send to</h2>
              <p className="mt-0.5 text-[13px] text-neutral-400">{EMAIL_HEALTH_FIELD_HINTS.sendTo}</p>
            </div>
            <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
              <div className="flex max-w-lg gap-2">
                <input
                  id="admin-email-test-to"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
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
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Message</h2>
              <p className="mt-0.5 text-[13px] text-neutral-400">{ADMIN_MESSAGE_BODY_HINT}</p>
            </div>
            <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
              <SupportMessageComposer
                editorKey={String(messageEditorKey)}
                html={messageDraft.html}
                textLength={messageDraft.textLength}
                onChange={setMessageDraft}
                placeholder="Write your test message…"
                minHeightClass="min-h-[10rem]"
                showSendButton={false}
                middleSlot={
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((open) => !open)}
                        className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100/80"
                        aria-expanded={showAdvanced}
                      >
                        <span>Advanced: email layout</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                      <Tooltip hint={EMAIL_HEALTH_FIELD_HINTS.layout} widthClassName="w-64">
                        <button
                          type="button"
                          className="shrink-0 rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-neutral-400 hover:bg-neutral-100/80 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          aria-label="About email layouts"
                        >
                          <Info className="h-4 w-4" aria-hidden />
                        </button>
                      </Tooltip>
                    </div>

                    {showAdvanced ? (
                      <div className="space-y-2">
                        <Select
                          label="Layout"
                          value={templateId}
                          onChange={(e) => setTemplateId(e.target.value)}
                        >
                          {grouped.map(({ category, templates: items }) => (
                            <optgroup key={category} label={category}>
                              {items.map((t) => (
                                <option
                                  key={t.id}
                                  value={t.id}
                                  title={emailHealthLayoutInfo(t.id).tooltip}
                                >
                                  {t.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </Select>
                        <p className="text-[13px] text-neutral-500">
                          {emailHealthLayoutInfo(templateId).tooltip}
                        </p>
                      </div>
                    ) : null}
                  </>
                }
                footerActions={
                  <Button
                    type="button"
                    onClick={() => void sendTest()}
                    loading={sending}
                    disabled={!toEmail.trim() || !isSupportDraftValid(messageDraft.textLength)}
                    icon={<Mail className="h-4 w-4" aria-hidden />}
                  >
                    Send test email
                  </Button>
                }
              />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <LayoutInfoPanel templateId={activeTemplateId} />
        </aside>
      </div>
    </div>
  );
}
