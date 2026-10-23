"use client";

import { X } from "lucide-react";
import { VENDOR_COPILOT } from "@/features/vendor/copilot/copilotBranding";
import { useVendorCopilot } from "@/features/vendor/copilot/VendorCopilotContext";
import { VendorCopilotThread } from "./VendorCopilotThread";
import { VendorGrowthBriefCard } from "./VendorGrowthBriefCard";

/** Co-pilot panel only — vendor FAB is merged into HelpWidget. */
export function VendorCopilotWidget() {
  const { open, view, closeCopilot, setView } = useVendorCopilot();

  if (!open) return null;

  return (
    <>
      <div
        role="dialog"
        aria-label={VENDOR_COPILOT.name}
        className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[min(640px,calc(100vh-10rem))] sm:w-[min(420px,calc(100vw-2.5rem))] sm:rounded-2xl sm:border sm:border-line sm:pt-0 sm:pb-0 sm:shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3 sm:rounded-t-2xl">
          <div>
            <p className="text-sm font-semibold text-ink">{VENDOR_COPILOT.meetHeading}</p>
            {view.name === "home" ? (
              <p className="text-xs text-ink-3">{VENDOR_COPILOT.tagline}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={closeCopilot}
            className="rounded-md p-1.5 text-ink-3 transition hover:bg-surface-3"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {view.name === "home" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <VendorGrowthBriefCard onOpenCopilot={() => setView({ name: "chat" })} />
            <button
              type="button"
              onClick={() => setView({ name: "chat" })}
              className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              {VENDOR_COPILOT.chatCta}
            </button>
          </div>
        ) : (
          <VendorCopilotThread
            embedded
            onClose={closeCopilot}
            initialQuestion={view.initialQ}
          />
        )}
      </div>

      <button
        type="button"
        aria-label={`Close ${VENDOR_COPILOT.name}`}
        className="fixed inset-0 z-40 bg-black/20 sm:hidden"
        onClick={closeCopilot}
      />
    </>
  );
}
