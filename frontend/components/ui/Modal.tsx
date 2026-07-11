"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

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
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClassName}`}>
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
        <div className={`mx-auto mt-8 rounded-2xl bg-white shadow-xl ${maxWidthClassName}`}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {children ? <div className="px-5 py-4">{children}</div> : null}
          {footer ? <div className="border-t border-neutral-200 px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
