"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { changePassword } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { adminPasswordSchema, changePasswordSchema, parseForm } from "@/lib/validation";
import { z } from "zod";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Use stricter admin password rules when changing an admin account password. */
  passwordSchema?: "default" | "admin";
  /** Where to send the user after a successful change (sessions are revoked server-side). */
  signInPath?: string;
};

function buildSchema(mode: "default" | "admin") {
  const newPasswordSchema = mode === "admin" ? adminPasswordSchema : z.string().min(6, "Password must be at least 6 characters.");
  return z
    .object({
      currentPassword: z.string().min(1, "Enter your current password."),
      newPassword: newPasswordSchema,
      confirmPassword: newPasswordSchema,
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    });
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  passwordSchema = "default",
  signInPath = "/login",
}: Props) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const minLength = passwordSchema === "admin" ? 12 : 6;
  const schema = passwordSchema === "admin" ? buildSchema("admin") : changePasswordSchema;

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setFieldErrors({});
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const save = async () => {
    setError(null);
    setFieldErrors({});
    const parsed = parseForm(schema, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setSaving(true);
    try {
      await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
      track(MixpanelEvents.password_changed);
      reset();
      onClose();
      showToast({
        title: "Password updated",
        description: "Sign in again with your new password.",
        tone: "success",
      });
      await signOut();
      router.replace(signInPath);
    } catch (err: unknown) {
      setError(getApiErrorDetail(err) ?? "Could not update password. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change password"
      maxWidthClassName="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!currentPassword || !newPassword || !confirmPassword}
            onClick={() => void save()}
          >
            Update password
          </Button>
        </div>
      }
    >
      <p className="text-sm text-neutral-600">
        Enter your current password, then choose a new one.
        {passwordSchema === "admin"
          ? " Admin passwords must be at least 6 characters with an uppercase letter, a number, and a symbol."
          : null}
      </p>
      {error ? <LottieFailureInline message={error} className="mt-3" /> : null}
      <div className="mt-4 space-y-3">
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={currentPassword}
          error={fieldErrors.currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          minLength={minLength}
          value={newPassword}
          error={fieldErrors.newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          minLength={minLength}
          value={confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
    </Modal>
  );
}
