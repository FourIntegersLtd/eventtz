"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  CompactActionRow,
  type SupportAction,
} from "./AdminBookingDetailShared";
import { VISIBLE_ACTION_COUNT } from "./adminBookingSupportActions";

type Feedback = {
  tone: "success" | "error";
  title: string;
  message: string;
};

type Props = {
  canRunBookingSupportActions: boolean;
  supportActions: SupportAction[];
  actionBusy: string | null;
  pendingAction: SupportAction | null;
  onPendingActionChange: (action: SupportAction | null) => void;
  onRunAction: (action: SupportAction) => void;
  cancelParty: "client" | "vendor";
  onCancelPartyChange: (party: "client" | "vendor") => void;
  cancelReason: string;
  onCancelReasonChange: (reason: string) => void;
  cancelFormValid: boolean;
  feedback: Feedback | null;
  onFeedbackClose: () => void;
};

export function AdminBookingSupportActionsPanel({
  canRunBookingSupportActions,
  supportActions,
  actionBusy,
  pendingAction,
  onPendingActionChange,
  onRunAction,
  cancelParty,
  onCancelPartyChange,
  cancelReason,
  onCancelReasonChange,
  cancelFormValid,
  feedback,
  onFeedbackClose,
}: Props) {
  const [actionsExpanded, setActionsExpanded] = useState(false);

  const cancelAction = supportActions.find((a) => a.id === "cancel");
  const nonCancelActions = supportActions.filter((a) => a.id !== "cancel");
  const primaryActions = nonCancelActions.slice(0, VISIBLE_ACTION_COUNT);
  const moreActions = nonCancelActions.slice(VISIBLE_ACTION_COUNT);

  return (
    <>
      <aside className="lg:sticky lg:top-6">
        <section>
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            Support actions
          </h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            {canRunBookingSupportActions
              ? "Hover for when to use · logged in audit"
              : "Payment and refund actions are limited to super admins"}
          </p>

          <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
            {canRunBookingSupportActions ? (
              <div className="px-3 py-2 sm:px-4">
                <div className="space-y-0.5">
                  {primaryActions.map((action) => (
                    <CompactActionRow
                      key={action.id}
                      action={action}
                      busy={actionBusy === action.id}
                      onSelect={onPendingActionChange}
                    />
                  ))}
                </div>

                {moreActions.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActionsExpanded((v) => !v)}
                      className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-[12px] font-medium text-primary hover:underline"
                    >
                      {actionsExpanded ? "Show fewer" : `More actions (${moreActions.length})`}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${actionsExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {actionsExpanded ? (
                      <div className="space-y-0.5 border-t border-neutral-100 pt-2">
                        {moreActions.map((action) => (
                          <CompactActionRow
                            key={action.id}
                            action={action}
                            busy={actionBusy === action.id}
                            onSelect={onPendingActionChange}
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {cancelAction ? (
                  <div className="mt-2 border-t border-neutral-100 pt-2">
                    <CompactActionRow
                      action={cancelAction}
                      busy={actionBusy === "cancel"}
                      onSelect={onPendingActionChange}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-neutral-600">
                You can review this booking and escalate if needed.
              </p>
            )}
          </div>
        </section>
      </aside>

      <Modal
        isOpen={Boolean(pendingAction)}
        onClose={() => {
          if (!actionBusy) onPendingActionChange(null);
        }}
        title={pendingAction ? pendingAction.title : "Confirm"}
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => onPendingActionChange(null)}
              disabled={Boolean(actionBusy)}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction?.destructive ? "destructive" : "primary"}
              loading={Boolean(actionBusy)}
              disabled={pendingAction?.id === "cancel" && !cancelFormValid}
              onClick={() => {
                if (pendingAction) void onRunAction(pendingAction);
              }}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-left">
          {pendingAction ? (
            <p className="text-sm leading-relaxed text-neutral-700">{pendingAction.confirmBody}</p>
          ) : null}

          {pendingAction?.id === "cancel" ? (
            <div className="space-y-2">
              <label className="block text-sm">
                <span className="text-neutral-600">On behalf of</span>
                <select
                  value={cancelParty}
                  onChange={(e) => onCancelPartyChange(e.target.value as "client" | "vendor")}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Reason (required, at least 3 characters)</span>
                <input
                  value={cancelReason}
                  onChange={(e) => onCancelReasonChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="Why support is cancelling"
                />
              </label>
            </div>
          ) : null}

          <p className="text-xs text-neutral-500">Recorded in the admin audit log.</p>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(feedback)}
        onClose={onFeedbackClose}
        title={feedback?.title ?? "Result"}
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex justify-end">
            <Button onClick={onFeedbackClose}>Done</Button>
          </div>
        }
      >
        <p
          className={`text-sm ${
            feedback?.tone === "error" ? "text-red-700" : "text-neutral-800"
          }`}
        >
          {feedback?.message}
        </p>
      </Modal>
    </>
  );
}
