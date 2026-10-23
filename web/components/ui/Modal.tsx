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
  /**
   * Replaces the default title bar (the caller renders its own close button). `title` then only names the
   * dialog for assistive tech.
   */
  header?: React.ReactNode;
  /** Replaces the panel shape: radius, fill, shadow and max height. */
  panelClassName?: string;
  /** Replaces the body's fill and padding. */
  bodyPaddingClassName?: string;
  /** Replaces the footer's border, fill and padding. */
  footerClassName?: string;
  /** Replaces the backdrop fill. */
  scrimClassName?: string;
  /** Replaces how the panel sits in the viewport (alignment and padding), e.g. a bottom sheet on phones. */
  positionClassName?: string;
};

const DEFAULT_PANEL = "rounded-card bg-white shadow-overlay max-h-[min(90dvh,720px)]";
const DEFAULT_BODY_PADDING = "bg-page-bg px-4 py-4 sm:px-5 sm:py-5";
const DEFAULT_FOOTER = "border-t border-line bg-white px-4 py-3 sm:px-5 sm:py-4";
const DEFAULT_POSITION = "items-center justify-center p-4 sm:p-6";

/** The standard title bar with a close button. */
function DefaultModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
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
        className={`inline-flex shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 ${TOUCH_TARGET} ${FOCUS_RING}`}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

/**
 * Dialog on a scrim. The `*ClassName` and `header` overrides exist for the copied legacy overlays that keep their
 * own look; new screens use the defaults.
 */
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
  header,
  panelClassName = DEFAULT_PANEL,
  bodyPaddingClassName = DEFAULT_BODY_PADDING,
  footerClassName = DEFAULT_FOOTER,
  scrimClassName = "bg-scrim",
  positionClassName = DEFAULT_POSITION,
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
            className={`absolute inset-0 ${scrimClassName}`}
            onClick={onClose}
          />
          <div className={`absolute inset-0 flex overflow-y-auto ${positionClassName}`}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={header ? undefined : "modal-title"}
              aria-label={header ? title : undefined}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 4 }}
              transition={transition}
              className={`my-auto flex w-full flex-col overflow-hidden ${panelClassName} ${MODAL_PANEL} ${maxWidthClassName}`}
            >
              {header ?? <DefaultModalHeader title={title} onClose={onClose} />}
              {children ? (
                <div
                  className={`min-h-0 flex-1 overflow-y-auto ${bodyPaddingClassName} ${bodyMaxHeightClassName} ${bodyClassName ?? ""}`.trim()}
                >
                  {children}
                </div>
              ) : null}
              {footer ? (
                <div className={`shrink-0 ${footerClassName}`}>
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
