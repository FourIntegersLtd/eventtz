"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { FOCUS_RING, MOTION, SHADOW, TOUCH_TARGET } from "@/components/ui/tokens";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

export type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  /** Stack above other overlays (e.g. nested drawers). */
  zIndexClassName?: string;
};

/**
 * Slide-over panel used for the inline chat drawer, quote form, and dispute
 * form. Focus-trapped, Escape-to-close, restores focus to the trigger on
 * close — the interaction contract every consumer inherits for free instead
 * of re-implementing it per feature.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClassName = "max-w-md",
  zIndexClassName = "z-50",
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = usePrefersReducedMotion();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    triggerElementRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (triggerElementRef.current instanceof HTMLElement) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen]);

  const transition = {
    duration: MOTION.durationStandardMs / 1000,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className={`fixed inset-0 ${zIndexClassName}`} role="presentation">
          <motion.button
            type="button"
            aria-label="Close panel"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={transition}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduceMotion ? undefined : { x: "100%" }}
            transition={transition}
            className={`absolute inset-y-0 right-0 flex h-full w-full max-w-[100vw] flex-col border-l border-neutral-200 bg-white ${widthClassName} ${SHADOW.overlay}`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate font-heading text-lg font-semibold text-neutral-900">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-sm text-neutral-500">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className={`inline-flex shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 ${TOUCH_TARGET} ${FOCUS_RING}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="scroll-pane min-h-0 flex-1 px-5 py-4">{children}</div>
            {footer ? <div className="border-t border-neutral-200 px-5 py-4">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
