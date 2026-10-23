"use client";

import { useState } from "react";
import { formControlClass } from "@/components/ui/tokens";
import { ChevronDown } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { CompactActionRow, type SupportAction } from "./AdminBookingDetailShared";
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
  cancelExceptional: boolean;
  onCancelExceptionalChange: (exceptional: boolean) => void;
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
  cancelExceptional,
  onCancelExceptionalChange,
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
      <Card as="section">
        <Card.Header>
          <h2 className="ez-h3">Support actions</h2>
        </Card.Header>
        <Card.Body>
          <p className="ez-small">
            {canRunBookingSupportActions
              ? "Hover for when to use. Recorded in the admin audit log."
              : "Payment and refund actions are limited to super admins."}
          </p>

          {canRunBookingSupportActions ? (
            <div className="ez-stack ez-stack--sm mt-3">
              {primaryActions.map((action) => (
                <CompactActionRow
                  key={action.id}
                  action={action}
                  busy={actionBusy === action.id}
                  onSelect={onPendingActionChange}
                />
              ))}

              {moreActions.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActionsExpanded((value) => !value)}
                    className={getButtonClassName({ variant: "ghost", size: "sm" })}
                  >
                    {actionsExpanded ? "Show fewer" : `More actions (${moreActions.length})`}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${actionsExpanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {actionsExpanded
                    ? moreActions.map((action) => (
                        <CompactActionRow
                          key={action.id}
                          action={action}
                          busy={actionBusy === action.id}
                          onSelect={onPendingActionChange}
                        />
                      ))
                    : null}
                </>
              ) : null}

              {cancelAction ? (
                <>
                  <hr className="ez-divider" />
                  <CompactActionRow
                    action={cancelAction}
                    busy={actionBusy === "cancel"}
                    onSelect={onPendingActionChange}
                  />
                </>
              ) : null}

              <Banner tone="warning" title="Confirm before moving money">
                Refunds and payouts change real balances. You will confirm each action.
              </Banner>
            </div>
          ) : (
            <p className="ez-small mt-3">
              You can review this booking and escalate if needed.
            </p>
          )}
        </Card.Body>
      </Card>

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
        <div className="ez-stack text-left">
          {pendingAction ? (
            <p className="text-sm leading-relaxed text-ink-2">{pendingAction.confirmBody}</p>
          ) : null}

          {pendingAction?.id === "cancel" ? (
            <div className="space-y-2">
              <label className="block text-sm">
                <span className="text-ink-2">On behalf of</span>
                <select
                  value={cancelParty}
                  onChange={(e) => onCancelPartyChange(e.target.value as "client" | "vendor")}
                  className={formControlClass("mt-1")}
                >
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-ink-2">Reason (required, at least 3 characters)</span>
                <input
                  value={cancelReason}
                  onChange={(e) => onCancelReasonChange(e.target.value)}
                  className={formControlClass("mt-1")}
                  placeholder="Why support is cancelling"
                />
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  checked={cancelExceptional}
                  onChange={(e) => onCancelExceptionalChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line-strong"
                />
                <span>Exceptional circumstances (does not count against the vendor)</span>
              </label>
            </div>
          ) : null}

          <p className="text-xs text-ink-3">Recorded in the admin audit log.</p>
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
            feedback?.tone === "error" ? "text-red-700" : "text-ink"
          }`}
        >
          {feedback?.message}
        </p>
      </Modal>
    </>
  );
}
