"use client";

import { Button } from "@/components/ui/Button";

type AdminVendorRemindersPanelProps = {
  selectedCount: number;
  selectedDraftCount: number;
  selectedPayoutCount: number;
  nudgeBusy: boolean;
  onSelectAllOnPage: () => void;
  onClearPage: () => void;
  onNudgeProfile: () => void;
  onNudgePayout: () => void;
};

/** Bulk profile / payout reminder controls (lives inside the vendor filter modal). */
export function AdminVendorRemindersPanel({
  selectedCount,
  selectedDraftCount,
  selectedPayoutCount,
  nudgeBusy,
  onSelectAllOnPage,
  onClearPage,
  onNudgeProfile,
  onNudgePayout,
}: AdminVendorRemindersPanelProps) {
  return (
    <div className="border-t border-line pt-6">
      <h3 className="text-sm font-medium text-ink">Reminder emails</h3>
      <p className="ez-small mt-1 text-ink-2">
        Use the checkboxes in the table, then send a one-off reminder.
      </p>

      <p className="ez-small mt-3 text-ink-2">
        {selectedCount > 0 ? (
          <>
            <span className="font-medium text-ink">{selectedCount} selected</span>
            {selectedDraftCount > 0 ? (
              <span>{` · ${selectedDraftCount} draft`}</span>
            ) : null}
            {selectedPayoutCount > 0 ? (
              <span>{` · ${selectedPayoutCount} need payouts`}</span>
            ) : null}
          </>
        ) : (
          <span className="text-ink-3">No vendors selected yet</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          type="button"

          onClick={onSelectAllOnPage}
          disabled={nudgeBusy}>
          Select all on page
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"

          onClick={onClearPage}
          disabled={nudgeBusy || selectedCount === 0}>
          Clear selection
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full justify-center"
          disabled={nudgeBusy || selectedDraftCount === 0}
          onClick={onNudgeProfile}
        >
          Remind to complete profile
          {selectedDraftCount > 0 ? ` (${selectedDraftCount})` : ""}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full justify-center"
          disabled={nudgeBusy || selectedPayoutCount === 0}
          onClick={onNudgePayout}
        >
          Remind to set up payouts
          {selectedPayoutCount > 0 ? ` (${selectedPayoutCount})` : ""}
        </Button>
      </div>
    </div>
  );
}
