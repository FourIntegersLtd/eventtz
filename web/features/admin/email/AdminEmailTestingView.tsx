"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Info, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
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
  for (const template of templates) {
    const list = byCategory.get(template.category) ?? [];
    list.push(template);
    byCategory.set(template.category, list);
  }
  const categories = [
    ...order.filter((category) => byCategory.has(category)),
    ...[...byCategory.keys()].filter((category) => !order.includes(category)).sort(),
  ];
  return categories.map((category) => ({
    category,
    templates: (byCategory.get(category) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
  }));
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
  const layoutInfo = emailHealthLayoutInfo(activeTemplateId);

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
      <Banner tone="warning" title="Super admin only">
        <p className="ez-small">Only super admins can send test emails.</p>
      </Banner>
    );
  }

  if (loading) {
    return <AdminLoadingState label="Loading email tools…" />;
  }

  return (
    <div className="w-full min-w-0 max-w-3xl ez-stack ez-stack--lg">
      <Banner tone="neutral" title="Super admin only">
        <p className="ez-small">
          This page shows delivery data and the suppression list. Admins do not see it in the menu.
        </p>
      </Banner>

      {error ? <AdminErrorBanner message={error} onRetry={() => void load()} /> : null}
      {success ? (
        <Banner tone="success">
          <p className="ez-small">{success}</p>
        </Banner>
      ) : null}

      <Card as="section" className="overflow-hidden">
        <Card.Header>
          <h2 className="ez-h3">Send a test email</h2>
          <p className="ez-small">
            No deliverability dashboard yet. Use this to preview layouts and confirm Resend delivery.
          </p>
        </Card.Header>
        <Card.Body className="ez-stack ez-stack--lg">
          <label className="ez-field" htmlFor="admin-email-test-to">
            <span className="ez-label">Send to</span>
            <span className="ez-caption">{EMAIL_HEALTH_FIELD_HINTS.sendTo}</span>
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
                className="ez-input min-w-0 flex-1"
              />
              {toEmail ? (
                <Button variant="secondary" size="sm" onClick={() => setToEmail("")}>
                  Clear
                </Button>
              ) : null}
            </div>
          </label>

          <div className="ez-field">
            <span className="ez-label">Message</span>
            <span className="ez-caption">{ADMIN_MESSAGE_BODY_HINT}</span>
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
                    <Button
                      variant="secondary"
                      onClick={() => setShowAdvanced((open) => !open)}
                      className="flex min-w-0 flex-1 justify-between"
                      aria-expanded={showAdvanced}
                      icon={
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      }
                    >
                      Advanced: email layout
                    </Button>
                    <Tooltip hint={EMAIL_HEALTH_FIELD_HINTS.layout} widthClassName="w-64">
                      <button
                        type="button"
                        className="ez-icon-btn ez-icon-btn--outline shrink-0"
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
                      <p className="text-[13px] text-ink-3">
                        {emailHealthLayoutInfo(templateId).tooltip}
                      </p>
                    </div>
                  ) : null}

                  <div className="ez-callout">
                    <p className="text-sm font-medium text-ink">{layoutInfo.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{layoutInfo.summary}</p>
                  </div>
                </>
              }
              footerActions={
                <Button
                  icon={<Mail className="h-4 w-4" aria-hidden />}
                  disabled={sending || !toEmail.trim() || !isSupportDraftValid(messageDraft.textLength)}
                  onClick={() => void sendTest()}
                >
                  {sending ? "Sending…" : "Send test"}
                </Button>
              }
            />
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
