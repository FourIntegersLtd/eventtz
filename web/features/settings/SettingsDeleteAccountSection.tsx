"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { resetMixpanel } from "@/lib/mixpanelClient";
import { getApiErrorCode, getApiErrorDetail } from "@/lib/api-errors";
import { deleteAccountSchema, parseForm } from "@/lib/validation";
import { deleteOwnAccount } from "@/lib/userSettingsApi";
import { SettingsSection } from "./SettingsSection";

const DELETE_CONFLICT_MESSAGES: Record<string, string> = {
  money_in_flight:
    "You have a booking with payment still in progress. Finish payout or wait for a refund, then try again.",
  active_booking:
    "You have an accepted booking that has not happened yet. Complete or cancel it first, then try again.",
  open_dispute:
    "You have an open problem report. Wait until it is resolved, then try again.",
};

/** Maps a close-account failure to the copy both settings screens show. */
export function deleteAccountErrorMessage(err: unknown): string {
  const code = getApiErrorCode(err);
  if (code && DELETE_CONFLICT_MESSAGES[code]) {
    return DELETE_CONFLICT_MESSAGES[code];
  }
  return getApiErrorDetail(err) ?? "Could not delete your account. Try again.";
}

export function SettingsDeleteAccountSection() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const close = () => {
    if (loading) return;
    setOpen(false);
    setPassword("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const parsed = parseForm(deleteAccountSchema, { password });
    if (!parsed.ok) {
      setError(parsed.formError ?? parsed.fieldErrors.password ?? "Enter your password.");
      return;
    }
    setLoading(true);
    try {
      await deleteOwnAccount(parsed.data.password);
      resetMixpanel();
      try {
        await signOut();
      } catch {
        /* cookies already cleared */
      }
      router.replace("/");
    } catch (err: unknown) {
      setError(deleteAccountErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SettingsSection
        title="Delete account"
        description="Permanently close your Eventtz account."
      >
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm text-neutral-600">
            Your profile and personal data are deleted. Anonymised booking and payment
            records may be kept where UK law requires.
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-4"
            icon={<Trash2 className="h-4 w-4" aria-hidden />}
            onClick={() => setOpen(true)}
          >
            Delete account
          </Button>
        </div>
      </SettingsSection>

      <Modal
        isOpen={open}
        onClose={close}
        title="Delete your account?"
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={loading} onClick={close}>
              Keep account
            </Button>
            <Button
              variant="destructive"
              loading={loading}
              disabled={!password.trim()}
              onClick={() => void submit()}
            >
              Delete account
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-700">
          This cannot be undone. You will be signed out. You can register again later with
          the same email; it will be a new account.
        </p>
        {error ? <LottieFailureInline message={error} className="mt-3" /> : null}
        <div className="mt-4">
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
