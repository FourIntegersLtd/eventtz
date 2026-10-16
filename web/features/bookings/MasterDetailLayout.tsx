import type { ReactNode } from "react";

export type MasterDetailLayoutProps = {
  list: ReactNode;
  detail: ReactNode;
  /**
   * When a row is selected, mobile shows only the detail pane (full-screen,
   * with its own back link) instead of squeezing both into view - desktop
   * always shows both side by side.
   */
  hasSelection: boolean;
};

/**
 * Two-pane list/detail shell shared by client and vendor bookings (and
 * reusable for notifications). Desktop keeps both panes visible like a
 * mail client; mobile shows one pane at a time so context never gets lost.
 */
const paneChildFill =
  "[&>*]:flex [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:flex-col";

export function MasterDetailLayout({ list, detail, hasSelection }: MasterDetailLayoutProps) {
  return (
    <div className="flex h-full max-h-full min-h-0 flex-1 flex-col gap-0 md:gap-6 lg:flex-row lg:gap-8">
      <div
        className={`flex h-full max-h-full min-h-0 min-w-0 flex-1 flex-col ${paneChildFill} lg:max-w-md ${hasSelection ? "hidden lg:flex" : ""}`}
      >
        {list}
      </div>
      <div
        className={`flex h-full max-h-full min-h-0 min-w-0 flex-1 flex-col ${paneChildFill} ${hasSelection ? "" : "hidden lg:flex"}`}
      >
        {detail}
      </div>
    </div>
  );
}
