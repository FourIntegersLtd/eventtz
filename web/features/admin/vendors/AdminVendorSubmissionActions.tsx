"use client";

import { useCallback, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  emptySupportDraft,
  isSupportDraftValid,
  SupportMessageComposer,
} from "@/features/admin/messages/SupportMessageComposer";
import {
  plainTextToSupportHtml,
  type SupportRichTextChange,
} from "@/features/admin/messages/SupportRichTextEditor";
import { getApiErrorDetail } from "@/lib/api-errors";
import { sendAdminMessages } from "@/lib/adminMessagesApi";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import type { AdminVendorUnsubmitHandler } from "./vendorUnsubmitTypes";
import {
  buildMissingChecklistMessage,
  countMissingChecklistItems,
  type AdminSubmissionChecklistGroup,
} from "./adminVendorSubmissionReviewModel";

type Props = {
  vendor: AdminVendorRow;
  checklistGroups: AdminSubmissionChecklistGroup[];
  businessName: string;
  busyId: string | null;
  onUnsubmit: AdminVendorUnsubmitHandler;
  onReportError?: (message: string) => void;
};

export function AdminVendorSubmissionActions({
  vendor,
  checklistGroups,
  businessName,
  busyId,
  onUnsubmit,
  onReportError,
}: Props) {
  const submittedPending =
    vendor.onboarding_status === "submitted" && vendor.approval_status === "pending";
  const missingCount = useMemo(
    () => countMissingChecklistItems(checklistGroups),
    [checklistGroups],
  );
  const busy = busyId === vendor.user_id;
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState<SupportRichTextChange>(emptySupportDraft());
  const [composerKey, setComposerKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const defaultMessage = useMemo(
    () =>
      buildMissingChecklistMessage({
        businessName,
        groups: checklistGroups,
      }),
    [businessName, checklistGroups],
  );

  const openReturnModal = useCallback(() => {
    setLocalError(null);
    setMessageDraft(emptySupportDraft());
    setComposerKey((k) => k + 1);
    setModalOpen(true);
  }, []);

  const handleReturnSubmit = useCallback(async () => {
    if (!isSupportDraftValid(messageDraft.textLength)) return;
    setActionLoading(true);
    setLocalError(null);
    try {
      const unsubmit = await onUnsubmit(vendor.user_id, { message: messageDraft.html });
      if (!unsubmit) return;
      const result = await sendAdminMessages({
        recipient_user_ids: [vendor.user_id],
        body: messageDraft.html,
      });
      if ((result.sent ?? 0) < 1) {
        const failure = result.failures?.[0]?.error;
        throw new Error(failure ?? "Profile returned to draft, but the message failed.");
      }
      setModalOpen(false);

      const name = businessName || "Vendor";
      const supportSent = (result.sent ?? 0) > 0;
      let description = `${name}'s profile is back in draft.`;
      if (supportSent && unsubmit.email_sent) {
        description = `${name}'s profile is back in draft. Email and Eventtz Support message sent.`;
      } else if (supportSent) {
        description = `${name}'s profile is back in draft. Support message sent (email could not be confirmed).`;
      } else if (unsubmit.email_sent) {
        description = `${name}'s profile is back in draft. Email sent.`;
      }

      showToast({
        title: "Returned for edits",
        description,
        tone: "success",
        durationMs: 6000,
      });
    } catch (e) {
      const msg =
        getApiErrorDetail(e) ??
        "Profile returned to draft, but the Support message could not be sent.";
      setLocalError(msg);
      onReportError?.(msg);
      showToast({
        title: "Could not complete return",
        description: msg,
        tone: "error",
        durationMs: 7000,
      });
    } finally {
      setActionLoading(false);
    }
  }, [businessName, messageDraft, onReportError, onUnsubmit, showToast, vendor.user_id]);

  if (!submittedPending) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-950">
              {missingCount > 0
                ? `Submitted with ${missingCount} required item${missingCount === 1 ? "" : "s"} still missing.`
                : "Waiting for review."}
            </p>
            <p className="mt-1 text-xs text-amber-900/80">
              Return unlocks their profile for editing, emails them, and sends an Eventtz Support
              message explaining what to fix.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || actionLoading}
            onClick={openReturnModal}
            icon={<RotateCcw className="h-4 w-4" aria-hidden />}
            className="w-full shrink-0 sm:w-auto sm:self-center"
          >
            Return for edits
          </Button>
        </div>
        {localError && !modalOpen ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {localError}
          </p>
        ) : null}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          if (!actionLoading) setModalOpen(false);
        }}
        title="Return for edits"
        maxWidthClassName="max-w-lg"
        zIndexClassName="z-[70]"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              disabled={actionLoading}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={actionLoading}
              disabled={!isSupportDraftValid(messageDraft.textLength)}
              onClick={() => void handleReturnSubmit()}
            >
              Return &amp; send message
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-neutral-600">
          This returns {businessName || "the vendor"}&apos;s profile to draft, emails them, and
          sends the message below via Eventtz Support.
        </p>
        {localError ? (
          <p className="mb-3 text-sm text-red-700" role="alert">
            {localError}
          </p>
        ) : null}
        <SupportMessageComposer
          key={composerKey}
          html={messageDraft.html}
          textLength={messageDraft.textLength}
          initialHtml={plainTextToSupportHtml(defaultMessage)}
          onChange={setMessageDraft}
          onSend={() => void handleReturnSubmit()}
          loading={actionLoading}
          placeholder="Explain what the vendor needs to complete…"
          showSendButton={false}
          minHeightClass="min-h-[12rem]"
        />
      </Modal>
    </>
  );
}
