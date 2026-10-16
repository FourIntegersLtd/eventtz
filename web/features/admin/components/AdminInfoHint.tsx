"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FOCUS_RING, TOUCH_TARGET } from "@/components/ui/tokens";

export type AdminChartInfo = {
  /** Short headline inside the modal (defaults to chart title). */
  title?: string;
  /** What this shows, in plain English. */
  what: string;
  /** How the numbers are calculated / where they come from. */
  how: string;
};

type AdminInfoHintProps = {
  label: string;
  info: AdminChartInfo;
};

/** Help icon that opens a plain-English “what / how” modal. */
export function AdminInfoHint({ label, info }: AdminInfoHintProps) {
  const [open, setOpen] = useState(false);
  const title = info.title ?? `About: ${label}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Explain ${label}`}
        title="What is this?"
        className={`-mr-1 inline-flex shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-primary ${TOUCH_TARGET} ${FOCUS_RING}`}
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        maxWidthClassName="max-w-lg"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm leading-relaxed text-neutral-700">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              What this shows
            </p>
            <p className="mt-1">{info.what}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              How we calculate it
            </p>
            <p className="mt-1">{info.how}</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
