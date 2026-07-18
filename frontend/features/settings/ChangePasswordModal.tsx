"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { changePassword } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";
import { changePasswordSchema, parseForm } from "@/lib/validation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function ChangePasswordModal({ isOpen, onClose }: Props) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
    const parsed = parseForm(changePasswordSchema, {
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
      reset();
      onClose();
      showToast({
        title: "Password updated",
        description: "Use your new password the next time you sign in.",
        tone: "success",
      });
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
      </p>
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
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
          minLength={6}
          value={newPassword}
          error={fieldErrors.newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          minLength={6}
          value={confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
    </Modal>
  );
}
