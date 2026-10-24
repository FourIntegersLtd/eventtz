"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { FOCUS_RING, MODAL_PANEL, MOTION, TOUCH_TARGET } from "@/components/ui/tokens";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  /** Override scroll area max-height for the body (e.g. long admin review). */
  bodyMaxHeightClassName?: string;
  /** Extra classes for the scrollable body wrapper. */
  bodyClassName?: string;
  /** Stack above other overlays (e.g. nested dialogs). */
  zIndexClassName?: string;
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidthClassName = "max-w-3xl",
  bodyMaxHeightClassName = "max-h-[min(70dvh,640px)]",
  bodyClassName,
  zIndexClassName = "z-50",
}: ModalProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const transition = {
    duration: MOTION.durationStandardMs / 1000,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {isOpen ? (
        <div key="modal-overlay" className={`fixed inset-0 ${zIndexClassName}`}>
          <motion.button
            type="button"
            aria-label="Close modal"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={transition}
            className="absolute inset-0 bg-scrim"
            onClick={onClose}
          />
          <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 4 }}
              transition={transition}
              className={`my-auto flex w-full max-h-[min(90dvh,720px)] flex-col overflow-hidden rounded-card bg-white shadow-overlay ${MODAL_PANEL} ${maxWidthClassName}`}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-5 sm:py-4">
                <h2
                  id="modal-title"
                  className="font-heading min-w-0 flex-1 pr-2 text-base font-semibold text-ink sm:text-lg"
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className={`inline-flex shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink-2 ${TOUCH_TARGET} ${FOCUS_RING}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {children ? (
                <div
                  className={`min-h-0 flex-1 overflow-y-auto bg-page-bg px-4 py-4 sm:px-5 sm:py-5 ${bodyMaxHeightClassName} ${bodyClassName ?? ""}`.trim()}
                >
                  {children}
                </div>
              ) : null}
              {footer ? (
                <div className="shrink-0 border-t border-line bg-white px-4 py-3 sm:px-5 sm:py-4">
                  {footer}
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
