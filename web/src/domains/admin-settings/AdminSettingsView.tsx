"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { loginHref } from "@/foundation/session/loginHref";
import { AdminErrorBanner, isSuperAdmin } from "@/capabilities/admin-shell";
import { validatePasswordChange } from "@/domains/admin-settings/passwordChangeValidation";
import { isPlatformError } from "@/foundation/platform-client";
import { changeAdminPassword } from "@/domains/admin-settings/api";

/** `/admin/settings` — account details and change-password, matching `frontend/app/admin/settings`. */
export function AdminSettingsView() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChangePassword() {
    setError(null);
    const validationError = validatePasswordChange(newPassword, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      await signOut();
      router.replace(loginHref("/admin/settings", false));
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not change the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-2xl border border-primary-border bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Account</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">Email</dt>
          <dd className="text-neutral-900">{session?.user.email}</dd>
          <dt className="text-neutral-500">Role</dt>
          <dd className="text-neutral-900">{isSuperAdmin(session) ? "Super admin" : "Admin"}</dd>
        </dl>
      </div>

      <div className="rounded-2xl border border-primary-border bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Change password</h2>
        {error ? <AdminErrorBanner message={error} /> : null}
        <div className="mt-3 space-y-3">
          <TextField
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <Button
            loading={saving}
            disabled={!currentPassword || !newPassword}
            onClick={() => void handleChangePassword()}
          >
            Change password
          </Button>
          <p className="text-xs text-neutral-500">Changing your password signs you out everywhere, including here.</p>
        </div>
      </div>
    </div>
  );
}
