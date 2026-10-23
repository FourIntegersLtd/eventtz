/** Content of one toast; `components/ui/Toast` renders it and `lib/mutationFeedback` raises it. */
export type ToastTone = "success" | "error" | "neutral";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss after this many ms. Defaults to 4000. */
  durationMs?: number;
};
