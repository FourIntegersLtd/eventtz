"use client";

import { CheckCircle2, XCircle, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RADIUS, SHADOW, TOUCH_TARGET, FOCUS_RING } from "@/components/ui/tokens";

export type ToastTone = "success" | "error" | "neutral";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss after this many ms. Defaults to 4000. */
  durationMs?: number;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />,
  error: <XCircle className="h-5 w-5 text-red-600" aria-hidden />,
  neutral: null,
};

/**
 * App-wide toast host. Mount once near the root of each portal layout, then
 * call `useToast().showToast(...)` from anywhere — used for "Request sent",
 * "Review submitted", booking status changes, etc. instead of blocking
 * success modals.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const durationMs = toast.durationMs ?? 4000;
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 border border-neutral-200 bg-white p-4 animate-ui-slide-up ${RADIUS.md} ${SHADOW.overlay}`}
          >
            {TONE_ICON[toast.tone ?? "neutral"]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-sm text-neutral-600">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className={`inline-flex shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 ${TOUCH_TARGET} ${FOCUS_RING}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
