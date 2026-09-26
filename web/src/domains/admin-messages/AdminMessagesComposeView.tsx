"use client";

import { useState } from "react";
import { AdminErrorBanner, AdminSuccessBanner, adminCapabilities } from "@/capabilities/admin-shell";
import { useSession } from "@/foundation/session";
import { isPlatformError } from "@/foundation/platform-client";
import { sendAdminMessage } from "@/domains/admin-messages/api";

type RecipientMode = "selected" | "clients" | "vendors" | "users";

/**
 * Compose tab: send a support message to named users (any admin), or, for
 * super admins, broadcast to a whole audience. The baseline's compose view
 * offers a live directory search for picking users; that endpoint lives in
 * the admin-directory domain and domains may not import each other, so this
 * pragmatic substitute takes recipient user IDs as a comma-separated list.
 */
export function AdminMessagesComposeView() {
  const { session } = useSession();
  const canBroadcast = adminCapabilities.canBroadcastMessages(session);

  const [mode, setMode] = useState<RecipientMode>("selected");
  const [recipientIdsText, setRecipientIdsText] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const recipientUserIds = recipientIdsText
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      if (mode === "selected" && recipientUserIds.length === 0) {
        setError("Enter at least one recipient user ID.");
        return;
      }
      const result = await sendAdminMessage({
        body: body.trim(),
        ...(mode === "selected" ? { recipient_user_ids: recipientUserIds } : { audience: mode }),
      });
      const failedCount = result.failures?.length ?? 0;
      setNotice(
        failedCount
          ? `Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"} (${failedCount} failed).`
          : `Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}.`,
      );
      setBody("");
      if (mode === "selected") setRecipientIdsText("");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      {notice ? <AdminSuccessBanner message={notice} /> : null}

      <div className="rounded-2xl border border-primary-border bg-white p-4">
        <p className="text-sm font-medium text-neutral-900">Recipients</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked={mode === "selected"} onChange={() => setMode("selected")} />
            Selected users
          </label>
          {canBroadcast ? (
            <>
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={mode === "clients"} onChange={() => setMode("clients")} />
                All clients
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={mode === "vendors"} onChange={() => setMode("vendors")} />
                All vendors
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={mode === "users"} onChange={() => setMode("users")} />
                All users
              </label>
            </>
          ) : null}
        </div>
        {!canBroadcast ? (
          <p className="mt-3 text-xs text-neutral-500">
            Platform-wide broadcasts require a super admin. You can still message specific users by ID.
          </p>
        ) : null}
        {mode === "selected" ? (
          <input
            value={recipientIdsText}
            onChange={(event) => setRecipientIdsText(event.target.value)}
            placeholder="Recipient user IDs, comma-separated"
            className="mt-3 w-full rounded-xl border border-primary-border px-3 py-2 text-sm"
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-primary-border bg-white p-4">
        <p className="text-sm font-medium text-neutral-900">Message</p>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a support message…"
          rows={6}
          className="mt-2 w-full rounded-xl border border-primary-border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!body.trim() || sending}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
