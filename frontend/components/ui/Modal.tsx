"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
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
  zIndexClassName = "z-50",
}: ModalProps) {
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const transition = {
    duration: MOTION.durationStandardMs / 1000,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className={`fixed inset-0 ${zIndexClassName}`}>
          <motion.button
            type="button"
            aria-label="Close modal"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={transition}
            className="absolute inset-0 bg-black/45"
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
              className={`my-auto w-full rounded-2xl bg-white shadow-xl ${MODAL_PANEL} ${maxWidthClassName}`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 sm:px-5 sm:py-4">
                <h2
                  id="modal-title"
                  className="font-heading min-w-0 flex-1 pr-2 text-base font-semibold text-neutral-900 sm:text-lg"
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className={`inline-flex shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 ${TOUCH_TARGET} ${FOCUS_RING}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {children ? (
                <div className="max-h-[min(70dvh,640px)] overflow-y-auto px-4 py-4 sm:px-5">
                  {children}
                </div>
              ) : null}
              {footer ? (
                <div className="border-t border-neutral-200 px-4 py-3 sm:px-5 sm:py-4">{footer}</div>
              ) : null}
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
