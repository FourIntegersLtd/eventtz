"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import {
  postCopilotDraftReply,
  vendorCopilotErrorMessage,
} from "@/lib/vendorCopilotApi";
import { formControlClass } from "@/components/ui/tokens";

type Props = {
  bookingId: string;
  onUseDraft?: (message: string) => void;
};

export function VendorDraftReplyPanel({ bookingId, onUseDraft }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<"accept" | "decline" | "clarify">("accept");
  const [draft, setDraft] = useState("");
  const [tips, setTips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (nextIntent: "accept" | "decline" | "clarify") => {
    setIntent(nextIntent);
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const res = await postCopilotDraftReply({ booking_request_id: bookingId, intent: nextIntent });
      setDraft(res.draft_message);
      setTips(res.tips ?? []);
    } catch (e: unknown) {
      setError(vendorCopilotErrorMessage(e));
      setDraft("");
      setTips([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => void generate("accept")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Draft accept message
        </button>
        <span className="text-ink-3">·</span>
        <button
          type="button"
          onClick={() => void generate("clarify")}
          className="text-xs font-medium text-ink-2 hover:text-ink hover:underline"
        >
          Draft questions
        </button>
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="AI draft reply"
        maxWidthClassName="max-w-lg"
        zIndexClassName="z-[80]"
      >
        {loading ? (
          <p className="text-sm text-ink-2">Drafting your message…</p>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-ink-3">
              Review before sending. AI can make mistakes. This is a suggestion only.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className={formControlClass("rounded-xl focus:ring-2 focus:ring-primary/30")}
            />
            {tips.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-ink-2">
                {tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {onUseDraft && draft.trim() ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onUseDraft(draft.trim());
                    showToast({ title: "Draft added to chat", tone: "success" });
                    setOpen(false);
                  }}
                >
                  Use in chat
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={loading}
                onClick={() => void generate(intent)}
              >
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
