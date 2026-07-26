"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { inviteAdminColleague } from "@/lib/adminTeamApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { adminInviteLinkSchema, adminInviteManualSchema, parseForm } from "@/lib/validation";

type AdminCreateAdminModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (message: string) => void;
};

export function AdminCreateAdminModal({ isOpen, onClose, onCreated }: AdminCreateAdminModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useInviteLink, setUseInviteLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setEmail("");
    setPassword("");
    setUseInviteLink(true);
    setError(null);
    setFieldErrors({});
    setBusy(false);
  }, [isOpen]);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});
    const parsed = useInviteLink
      ? parseForm(adminInviteLinkSchema, { email: email.trim() })
      : parseForm(adminInviteManualSchema, { email: email.trim(), password });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setBusy(true);
    try {
      const inviteEmail = parsed.data.email;
      const invitePassword =
        "password" in parsed.data && typeof parsed.data.password === "string"
          ? parsed.data.password
          : undefined;
      const result = await inviteAdminColleague(inviteEmail, invitePassword);
      onCreated(result.message);
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorDetail(err) ?? "Could not create admin account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create admin account"
      maxWidthClassName="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void handleSubmit()}>
            {useInviteLink ? "Send invite link" : "Create admin"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex rounded-lg border border-neutral-200 p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-medium transition ${
              useInviteLink ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-50"
            }`}
            onClick={() => setUseInviteLink(true)}
          >
            Send invite link
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-medium transition ${
              !useInviteLink ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-50"
            }`}
            onClick={() => setUseInviteLink(false)}
          >
            Set password
          </button>
        </div>

        <TextField
          id="create-admin-email"
          label="Email (username)"
          type="email"
          autoComplete="off"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError("email");
          }}
          placeholder="colleague@company.com"
          required
        />

        {useInviteLink ? (
          <p className="text-sm text-neutral-600">
            We&apos;ll email a secure link so they can set their own password. No password is
            shared over email.
          </p>
        ) : (
          <PasswordField
            id="create-admin-password"
            label="Password"
            autoComplete="new-password"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
            }}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        )}
      </div>
    </Modal>
  );
}
