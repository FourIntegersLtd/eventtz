"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

export type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Heading and accessible name of the dialog. */
  title: string;
  /** Accessible name of the scrim button. */
  closeLabel?: string;
  /** DOM id of the sheet, so a caller can tell a click inside it from an outside click. */
  id?: string;
  /** Stacking class; defaults above portal chrome. */
  zIndexClassName?: string;
  children: ReactNode;
};

/**
 * Mobile bottom sheet: scrim plus a panel that slides up from the bottom edge. Feature code uses
 * this instead of importing `motion/react` itself (UI-CONVENTIONS.md). Render it inside a portal
 * when an ancestor clips or transforms fixed children.
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  closeLabel = "Close",
  id,
  zIndexClassName = "z-[105]",
  children,
}: BottomSheetProps) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <div key="bottom-sheet" className={`fixed inset-0 ${zIndexClassName} lg:hidden`} role="presentation">
          <motion.button
            type="button"
            aria-label={closeLabel}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
          >
            <h3 className="mb-2 font-heading text-base font-semibold text-ink">{title}</h3>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
